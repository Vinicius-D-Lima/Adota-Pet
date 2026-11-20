import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { HttpError, zodDetails } from './http.js'

interface Schemas {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

/**
 * Validação de corpo, query e parâmetros (#47 / INF-02) com os schemas Zod de
 * `@adotapet/shared`. O valor parseado substitui o original na request, então
 * `coerce`/`trim`/defaults do contrato chegam aos handlers já aplicados.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part]
      if (!schema) continue

      const parsed = schema.safeParse(req[part])
      if (!parsed.success) {
        return next(new HttpError(400, 'Validação falhou', zodDetails(parsed.error)))
      }
      // `req.query` é getter no Express 5: defineProperty funciona sem perder a request.
      Object.defineProperty(req, part, {
        value: parsed.data,
        configurable: true,
        enumerable: true,
        writable: true,
      })
    }
    next()
  }
}
