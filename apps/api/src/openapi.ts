import type { Express } from 'express'
import swaggerUi from 'swagger-ui-express'
import {
  adoptionRequestSchema,
  authLoginSchema,
  createAccountSchema,
  favoriteIdsResponseSchema,
  favoritePetIdParamsSchema,
  favoritesQuerySchema,
  favoritesResponseSchema,
  interviewApiSchema,
  notificationPageSchema,
  notificationPreferencesResponseSchema,
  notificationPreferencesUpdateSchema,
  notificationsQuerySchema,
  organizationPermissionsResponseSchema,
  organizationTransitionSchema,
  petIdParamsSchema,
  petsQuerySchema,
  petsResponseSchema,
  petSchema,
  profileSchema,
  receivedRequestSchema,
  receivedRequestsQuerySchema,
  receivedRequestsResponseSchema,
  registerSchema,
  requestChatCursorQuerySchema,
  requestChatMessageBodySchema,
  requestChatMessageSchema,
  requestChatPageSchema,
  requestStatusHistoryResponseSchema,
  requestTransitionSchema,
} from '@adotapet/shared'
import { z, type ZodType } from 'zod'
import { checkInReviewBodySchema, checkInSubmitBodySchema } from './routes/checkIns.js'

/** Documentação viva (#47 / INF-10): gerada a partir dos schemas Zod compartilhados. */
const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  database: z.enum(['ok', 'unavailable']),
})

/** Schemas de autenticação (#48): a documentação acompanha as rotas reais. */
const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  platformRole: z.enum(['USUARIO', 'MODERADOR']),
  role: z.string(),
  createdAt: z.string(),
})

const authResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  expiresIn: z.number().int(),
})

/** Parâmetro das rotas de adoção (#23). */
const idParamsSchema = z.object({ id: z.string().min(1) })
const followUpPlanSchema = z
  .object({
    durationDays: z.number().int().min(1).max(3650),
    intervalDays: z.number().int().min(1),
  })
  .strict()
  .refine(({ durationDays, intervalDays }) => intervalDays <= durationDays, {
    path: ['intervalDays'],
    message: 'intervalDays deve ser menor ou igual a durationDays',
  })

/** Parâmetro das rotas de leitura individual (#30). */
const notificationIdParamsSchema = z.object({ id: z.string().min(1) })

/** Parâmetro `id` das rotas de solicitação, incluindo o chat (#22/#50). */
const requestIdParamsSchema = z.object({ id: z.string().min(1) })

const authDocs: Record<string, RouteSchemas> = Object.fromEntries(
  ['/auth', '/api/auth'].flatMap((base) => [
    [`POST ${base}/register`, { body: registerSchema, response: authResponseSchema }],
    [`POST ${base}/login`, { body: authLoginSchema, response: authResponseSchema }],
    [`POST ${base}/refresh`, { response: authResponseSchema }],
    [`POST ${base}/logout`, {}],
    [`GET ${base}/me`, { response: authUserSchema }],
  ]),
)

interface RouteSchemas {
  query?: ZodType
  params?: ZodType
  body?: ZodType
  bodyContentType?: string
  response?: ZodType
}

const DOCUMENTED: Record<string, RouteSchemas> = {
  ...authDocs,
  'GET /me': { response: authUserSchema },
  'GET /health': { response: healthResponseSchema },
  'GET /api/pets': { query: petsQuerySchema, response: petsResponseSchema },
  'GET /api/pets/{id}': { params: petIdParamsSchema, response: petSchema },
  'PUT /api/me/account': { body: createAccountSchema, response: profileSchema },
  'GET /api/me/matches': {},
  'GET /api/me/permissions': { response: organizationPermissionsResponseSchema },
  'GET /api/me/received-requests': {
    query: receivedRequestsQuerySchema,
    response: receivedRequestsResponseSchema,
  },
  'GET /api/me/received-requests/{id}': { response: receivedRequestSchema },
  'POST /api/me/received-requests/{id}/interview': {
    body: interviewApiSchema,
    response: receivedRequestSchema,
  },
  'POST /api/me/received-requests/{id}/interview/complete': { response: receivedRequestSchema },
  'POST /api/me/received-requests/{id}/transitions': {
    body: organizationTransitionSchema,
    response: receivedRequestSchema,
  },
  'GET /api/me/favorites/ids': { response: favoriteIdsResponseSchema },
  'GET /api/me/favorites': { query: favoritesQuerySchema, response: favoritesResponseSchema },
  'PUT /api/me/favorites/{petId}': { params: favoritePetIdParamsSchema },
  'DELETE /api/me/favorites/{petId}': { params: favoritePetIdParamsSchema },
  // Adoções e plano de acompanhamento (#23).
  'GET /api/me/adoptions': {},
  'GET /api/organizations/{id}/adoptions': { params: idParamsSchema },
  'POST /api/adoptions/{id}/follow-up-plan': {
    params: idParamsSchema,
    body: followUpPlanSchema,
  },
  'PUT /api/adoptions/{id}/follow-up-plan': {
    params: idParamsSchema,
    body: followUpPlanSchema,
  },
  'POST /api/check-ins/{id}/submit': {
    params: idParamsSchema,
    body: checkInSubmitBodySchema,
    bodyContentType: 'multipart/form-data',
  },
  'POST /api/check-ins/{id}/review': {
    params: idParamsSchema,
    body: checkInReviewBodySchema,
  },
  'POST /api/check-ins/{id}/request-more': {
    params: idParamsSchema,
    body: checkInReviewBodySchema,
  },
  'POST /api/check-ins/{id}/photos/{photoId}/url': {
    params: z.strictObject({ id: z.string().min(1), photoId: z.string().min(1) }),
  },
  // Notificações (#30): contrato idêntico ao consumido pelo frontend.
  'GET /api/me/notifications': {
    query: notificationsQuerySchema,
    response: notificationPageSchema,
  },
  'PATCH /api/me/notifications/read-all': {},
  'PATCH /api/me/notifications/{id}/read': { params: notificationIdParamsSchema },
  'GET /api/me/notification-preferences': { response: notificationPreferencesResponseSchema },
  'PUT /api/me/notification-preferences': {
    body: notificationPreferencesUpdateSchema,
    response: notificationPreferencesResponseSchema,
  },
  // Chat da solicitação (#22): REST + polling na v1, contrato Zod compartilhado.
  'GET /api/requests/{id}/messages': {
    params: requestIdParamsSchema,
    query: requestChatCursorQuerySchema,
    response: requestChatPageSchema,
  },
  'POST /api/requests/{id}/messages': {
    params: requestIdParamsSchema,
    body: requestChatMessageBodySchema,
    response: requestChatMessageSchema,
  },
  'PATCH /api/requests/{id}/messages/read': { params: requestIdParamsSchema },
  // Máquina de estados (#20): endpoint central e linha do tempo auditável.
  'POST /api/requests/{id}/transitions': {
    params: requestIdParamsSchema,
    body: requestTransitionSchema,
    response: adoptionRequestSchema,
  },
  'GET /api/requests/{id}/status-history': {
    params: requestIdParamsSchema,
    response: requestStatusHistoryResponseSchema,
  },
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

/** Espelha os prefixos privados de `routes/index.ts` (#47). */
const isPrivatePath = (path: string) =>
  path === '/me' ||
  path.startsWith('/me/') ||
  path.startsWith('/api/me/') ||
  path.startsWith('/api/requests/') ||
  path.startsWith('/api/adoptions/') ||
  path.startsWith('/api/check-ins/') ||
  path.startsWith('/api/organizations/') ||
  path.endsWith('/auth/me')

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
        ...(method === 'POST' && path.endsWith('/follow-up-plan')
          ? { 201: { description: 'Plano criado' } }
          : {}),
        ...(method === 'GET' ? { 503: errorResponse } : {}),
        400: errorResponse,
        ...(isPrivatePath(path) || path.includes('/auth/') ? { 401: errorResponse } : {}),
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
        413: errorResponse,
        429: errorResponse,
        500: errorResponse,
      },
    }

    if (isPrivatePath(path)) {
      operation.security = [{ bearerAuth: [] }]
    }

    const parameters = [
      ...parametersFrom(schemas.params, 'path'),
      ...parametersFrom(schemas.query, 'query'),
    ]
    if (parameters.length) operation.parameters = parameters
    if (schemas.body) {
      const bodySchema = toOpenApiSchema(schemas.body)
      if (schemas.bodyContentType === 'multipart/form-data') {
        const properties = bodySchema.properties as Record<string, unknown>
        properties.files = {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: { type: 'string', format: 'binary' },
        }
        const required = Array.isArray(bodySchema.required) ? bodySchema.required : []
        bodySchema.required = [...required, 'files']
      }
      operation.requestBody = {
        required: true,
        content: {
          [schemas.bodyContentType ?? 'application/json']: { schema: bodySchema },
        },
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
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
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
