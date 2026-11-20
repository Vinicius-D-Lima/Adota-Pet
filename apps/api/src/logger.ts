import { randomUUID } from 'node:crypto'
import pino, { type DestinationStream, type Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import type { Request, RequestHandler } from 'express'

/**
 * Logs estruturados (#47 / INF-08).
 *
 * Toda linha carrega `requestId`. Os campos sensíveis são redigidos em
 * **qualquer profundidade** — body, query, headers e parâmetros — antes de
 * chegar ao transporte.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'cookie',
  'cpf',
  'cnpj',
  'document',
  'authorization',
  'secret',
])

export const REDACTED_PATHS = [...SENSITIVE_KEYS].map((key) => `*.${key}`)

/** Redação recursiva: cobre qualquer profundidade, inclusive arrays aninhados. */
export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item)) as T
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return value
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactSensitive(item),
      ]),
    ) as T
  }
  return value
}

const LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])

/** Nível inválido cai no padrão: quem valida e aponta o erro é `loadConfig`. */
function configuredLevel(): string {
  const level = process.env.LOG_LEVEL
  return level && LOG_LEVELS.has(level) ? level : 'info'
}

export function createLogger(
  options: {
    level?: string
    destination?: DestinationStream
  } = {},
): Logger {
  return pino(
    {
      level: options.level ?? configuredLevel(),
      redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
      serializers: {
        body: redactSensitive,
        query: redactSensitive,
        params: redactSensitive,
        headers: redactSensitive,
      },
    },
    options.destination,
  )
}

export const logger = createLogger()

type RequestWithId = Request & { id?: string }

/** Middleware pino-http: gera o id, logs a request e devolve `X-Request-Id`. */
export function requestLogger(loggerInstance: Logger = logger) {
  const httpLogger = pinoHttp({
    logger: loggerInstance,
    genReqId: () => randomUUID(),
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error'
      if (res.statusCode >= 400) return 'warn'
      return 'info'
    },
  })

  const requestIdHeader: RequestHandler = (req, res, next) => {
    const id = (req as RequestWithId).id
    if (id) res.setHeader('X-Request-Id', String(id))
    next()
  }

  return [httpLogger as unknown as RequestHandler, requestIdHeader] as const
}

/**
 * Loga metadados da requisição em nível `debug`. O redact do pino cobre os
 * valores sensíveis mesmo quando o corpo é inteiro enviado para o log.
 */
export function requestDetailsLogger(loggerInstance: Logger = logger): RequestHandler {
  return (req, _res, next) => {
    loggerInstance.debug(
      {
        requestId: (req as RequestWithId).id,
        method: req.method,
        url: req.originalUrl,
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      },
      'requisição recebida',
    )
    next()
  }
}
