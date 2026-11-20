import type { Express } from 'express'
import swaggerUi from 'swagger-ui-express'
import {
  createAccountSchema,
  petIdParamsSchema,
  petsQuerySchema,
  petsResponseSchema,
  petSchema,
  profileSchema,
} from '@adotapet/shared'
import { z, type ZodType } from 'zod'

/** Documentação viva (#47 / INF-10): gerada a partir dos schemas Zod compartilhados. */
const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  database: z.enum(['ok', 'unavailable']),
})

interface RouteSchemas {
  query?: ZodType
  params?: ZodType
  body?: ZodType
  response?: ZodType
}

const DOCUMENTED: Record<string, RouteSchemas> = {
  'GET /health': { response: healthResponseSchema },
  'GET /api/pets': { query: petsQuerySchema, response: petsResponseSchema },
  'GET /api/pets/{id}': { params: petIdParamsSchema, response: petSchema },
  'PUT /api/me/account': { body: createAccountSchema, response: profileSchema },
}

export interface ApiRoute {
  method: string
  path: string
}

const normalize = (path: string) =>
  (path || '/')
    .replace(/:([^/]+)/g, '{$1}')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '') || '/'

/**
 * Percorre o router do Express (incluindo os routers montados). Usar a própria
 * árvore de rotas como fonte garante que nenhuma rota fique fora da OpenAPI.
 */
export function listRoutes(app: Express): ApiRoute[] {
  const routes: ApiRoute[] = []

  interface Layer {
    route?: { path: string | string[]; methods: Record<string, boolean> }
    handle?: { stack?: unknown[] }
    rawPath?: string
  }

  const walk = (stack: unknown[], prefix = '') => {
    for (const layer of stack as Layer[]) {
      if (layer.route) {
        const routePath = Array.isArray(layer.route.path) ? layer.route.path[0] : layer.route.path
        if (typeof routePath !== 'string') continue
        for (const method of Object.keys(layer.route.methods ?? {})) {
          if (method === '_all') continue
          const path = normalize(prefix + routePath)
          // A própria documentação não precisa se documentar.
          if (path.startsWith('/docs')) continue
          routes.push({ method: method.toUpperCase(), path })
        }
      } else if (Array.isArray(layer.handle?.stack)) {
        const mount = typeof layer.rawPath === 'string' ? layer.rawPath : ''
        if (/[(*+]/.test(mount)) continue // layers de regex interna do Express
        walk(layer.handle.stack, prefix + mount)
      }
    }
  }

  walk((app as unknown as { router: { stack: unknown[] } }).router.stack)
  return [...new Map(routes.map((route) => [`${route.method} ${route.path}`, route])).values()]
}

/** JSON Schema do Zod 4 sem `$schema`, pronto para OpenAPI 3.1. */
function toOpenApiSchema(schema: ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>
  const stripDialect = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripDialect)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== '$schema')
          .map(([key, item]) => [key, stripDialect(item)]),
      )
    }
    return value
  }
  return stripDialect(json) as Record<string, unknown>
}

function parametersFrom(schema: ZodType | undefined, location: 'query' | 'path') {
  if (!(schema instanceof z.ZodObject)) return []
  return Object.entries(schema.shape).map(([name, field]) => ({
    name,
    in: location,
    required: !field.safeParse(undefined).success,
    schema: toOpenApiSchema(field),
  }))
}

const errorResponse = {
  description: 'Erro no formato padrão da API',
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
}

export function buildOpenApiDocument(app: Express) {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const { method, path } of listRoutes(app)) {
    const schemas = DOCUMENTED[`${method} ${path}`] ?? {}
    const operation: Record<string, unknown> = {
      operationId: `${method.toLowerCase()}${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      summary: schemas.response ? undefined : `${method} ${path}`,
      tags: [path.startsWith('/api') ? 'api' : 'infra'],
      responses: {
        200: {
          description: 'Sucesso',
          ...(schemas.response
            ? {
                content: {
                  'application/json': { schema: toOpenApiSchema(schemas.response) },
                },
              }
            : {}),
        },
        ...(method === 'GET' ? { 503: errorResponse } : {}),
        400: errorResponse,
        413: errorResponse,
        429: errorResponse,
        500: errorResponse,
      },
    }

    const parameters = [
      ...parametersFrom(schemas.params, 'path'),
      ...parametersFrom(schemas.query, 'query'),
    ]
    if (parameters.length) operation.parameters = parameters
    if (schemas.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: toOpenApiSchema(schemas.body) } },
      }
    }
    if (schemas.response) delete operation.summary

    paths[path] ??= {}
    paths[path][method.toLowerCase()] = operation
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'AdotaPet API',
      version: '1.0.0',
      description:
        'Contrato da API real. Schemas derivados de @adotapet/shared. Erros: { statusCode, error, message, details? }.',
    },
    paths,
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['statusCode', 'error', 'message'],
          properties: {
            statusCode: { type: 'integer' },
            error: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: { $ref: '#/components/schemas/FieldError' },
            },
          },
        },
        FieldError: {
          type: 'object',
          required: ['field', 'message'],
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }
}

export function mountDocs(app: Express) {
  const document = buildOpenApiDocument(app)
  app.get('/docs/openapi.json', (_req, res) => res.json(document))
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'AdotaPet API' }))
  return document
}
