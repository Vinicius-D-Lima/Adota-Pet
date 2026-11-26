import cors from 'cors'
import express, { type Express } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import type { Logger } from 'pino'
import { loadConfig, type ApiConfig } from './config.js'
import { errorHandler, sendError } from './http.js'
import { logger as defaultLogger, requestDetailsLogger, requestLogger } from './logger.js'
import type { MatchingStrategy } from './matching.js'
import { mountDocs } from './openapi.js'
import { createAuthRouter, meRouter } from './routes/auth.js'
import { createHealthRouter } from './routes/health.js'
import { createApiRouter } from './routes/index.js'
import { fileRouter } from './routes/storage.js'

export interface AppOptions {
  /** Sobrescreve valores validados (usado nos testes). */
  config?: Partial<ApiConfig>
  logger?: Logger
  /** Injetável para testar 200/503 do health sem derrubar o banco. */
  checkDatabase?: () => Promise<boolean>
  /** Estratégia de compatibilidade (MATCH-07). */
  matchingStrategy?: MatchingStrategy
}

/** Composição da aplicação (#47): segurança → observabilidade → rotas → erros. */
export function createApp(options: AppOptions = {}): Express {
  const config = { ...loadConfig(), ...options.config }
  const appLogger = options.logger ?? defaultLogger
  const app = express()

  app.disable('x-powered-by')
  app.use(
    helmet({
      // HSTS só em produção, para não quebrar desenvolvimento em http.
      hsts: config.NODE_ENV === 'production' ? { maxAge: 31_536_000 } : false,
    }),
  )
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Demo-User-Id', 'X-Demo-Role', 'Authorization', 'Cookie'],
    }),
  )
  app.use(express.json({ limit: config.BODY_LIMIT }))
  for (const middleware of requestLogger(appLogger)) app.use(middleware)
  app.use(requestDetailsLogger(appLogger))
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.setHeader('Retry-After', String(Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)))
        sendError(res, 429, 'Muitas requisições. Tente novamente em instantes.')
      },
    }),
  )

  // Autenticação (#48): aliases `/auth/*` (issue) e `/api/auth/*` (contrato da API).
  const authRouter = createAuthRouter(config)
  app.use(createHealthRouter(options.checkDatabase))
  app.use('/auth', authRouter)
  app.use('/api/auth', authRouter)
  // #22/CHAT-08: limite dedicado de envio de mensagens. Registrado aqui (e não
  // no router, que é singleton) para que cada instância da app tenha seu próprio
  // contador — os testes criam uma app nova por caso. A chave é o cliente
  // autenticado, não o IP compartilhado de uma rede.
  app.post(
    '/api/requests/:id/messages',
    rateLimit({
      windowMs: config.CHAT_RATE_LIMIT_WINDOW_MS,
      limit: config.CHAT_RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: (req) => req.get('Authorization') ?? ipKeyGenerator(req.ip ?? 'anon'),
      handler: (_req, res) => {
        res.setHeader('Retry-After', String(Math.ceil(config.CHAT_RATE_LIMIT_WINDOW_MS / 1000)))
        sendError(res, 429, 'Muitas mensagens enviadas. Tente novamente em instantes.')
      },
    }),
  )

  app.use('/me', meRouter)
  app.use(fileRouter)
  app.use('/api', createApiRouter(options))
  mountDocs(app)

  // Deve ser o último middleware: captura erros de parser, validação e handlers.
  app.use(errorHandler(appLogger))

  return app
}
