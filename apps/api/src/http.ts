import type { NextFunction, Request, Response } from 'express'
import type { Logger } from 'pino'
import { ZodError } from 'zod'
import { logger as defaultLogger } from './logger.js'

/** Nomes de status usados no corpo do erro (contrato #47). */
const STATUS_NAMES: Record<number, string> = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

export interface FieldError {
  field: string
  message: string
}

/** Formato de erro padrão (#47): `{ statusCode, error, message, details }`. */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  details?: FieldError[],
) {
  const body: { statusCode: number; error: string; message: string; details?: FieldError[] } = {
    statusCode,
    error: STATUS_NAMES[statusCode],
    message,
  }
  if (details) body.details = details
  res.status(statusCode).json(body)
}

export const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === ''

/** Envolta de lista do contrato: `{ data, total }`. */
export const list = <T>(data: T[]) => ({ data, total: data.length })

/** `page`/`limit` precisam ser inteiros positivos; empurra erro para `details`. */
export function positiveInt(
  value: unknown,
  field: string,
  details: FieldError[],
  fallback: number,
): number {
  if (value === undefined) return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    details.push({ field, message: `${field} deve ser um inteiro positivo` })
    return fallback
  }
  return number
}

/** Distância em km entre dois pontos (fórmula de haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

/** Erro esperado da aplicação: já tem status e mensagem públicos. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: FieldError[],
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/** Converte issues do Zod em `{ field, message }` para o `details` do contrato. */
export function zodDetails(error: ZodError): FieldError[] {
  return error.issues.flatMap((issue) => {
    // Em objetos .strict(), as chaves desconhecidas vêm em `keys`, não em `path`.
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, message: 'Parâmetro ou campo desconhecido' }))
    }
    return [{ field: issue.path.join('.') || 'body', message: issue.message }]
  })
}

/**
 * Middleware de erro global (#47 / INF-03): qualquer exceção sai no formato
 * padrão. O 500 é genérico — stack, caminho de arquivo e mensagens do ORM ficam
 * só no log estruturado.
 */
export function errorHandler(loggerInstance: Logger = defaultLogger) {
  return (error: unknown, req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as Request & { id?: string }).id

    // Se a resposta já começou, só o Express pode encerrar a conexão.
    if (res.headersSent) return next(error)

    if (error instanceof ZodError) {
      return sendError(res, 400, 'Validação falhou', zodDetails(error))
    }
    if (error instanceof HttpError) {
      return sendError(res, error.statusCode, error.message, error.details)
    }

    const type = (error as { type?: string } | null)?.type
    if (type === 'entity.too.large') {
      return sendError(res, 413, 'Corpo da requisição muito grande')
    }
    if (type === 'entity.parse.failed') {
      return sendError(res, 400, 'JSON inválido no corpo da requisição')
    }

    loggerInstance.error(
      { err: error, requestId },
      error instanceof Error ? error.message : 'Erro não identificado',
    )
    return sendError(res, 500, 'Erro interno do servidor')
  }
}
