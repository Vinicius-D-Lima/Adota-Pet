import { randomUUID } from 'node:crypto'
import { authLoginSchema, registerSchema } from '@adotapet/shared'
import { type Request, type Response, Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import {
  clearRefreshCookie,
  hashPassword,
  hashRefreshToken,
  issueTokens,
  readRefreshToken,
  requireAuth,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshCookie,
  verifyPassword,
} from '../auth.js'
import type { ApiConfig } from '../config.js'
import { publicUser } from '../context.js'
import { prisma } from '../db.js'
import { sendError } from '../http.js'
import { validate } from '../validate.js'
import type { User } from '../generated/prisma/client.js'

const INVALID_CREDENTIALS = 'Credenciais inválidas'
const INVALID_SESSION = 'Sessão inválida'

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'

/** Resposta de /me: o mesmo contrato de perfil, mas vindo do token. */
export function meHandler(req: Request, res: Response) {
  if (!req.user) return sendError(res, 401, 'Autenticação necessária')
  res.json(publicUser(req.user))
}

function tokenResponse(
  res: Response,
  user: User,
  tokens: Awaited<ReturnType<typeof issueTokens>>,
  status = 200,
) {
  setRefreshCookie(res, tokens.refreshToken)
  res.status(status).json({
    user: publicUser(user),
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  })
}

/** Router criado por app.ts para que o rate limit use a config injetada nos testes. */
export function createAuthRouter(config: ApiConfig) {
  const router = Router()

  /** Limite por IP + e-mail normalizado (AUTH-06). */
  const loginLimiter = rateLimit({
    windowMs: config.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: config.LOGIN_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Agrupa /64 de IPv6 para que um cliente não contorne o limite trocando de endereço.
      const ip = req.ip ? ipKeyGenerator(req.ip) : 'unknown'
      const email = String(req.body?.email ?? '')
        .trim()
        .toLowerCase()
      return `${ip}:${email}`
    },
    handler: (_req, res) => {
      res.setHeader('Retry-After', String(Math.ceil(config.LOGIN_RATE_LIMIT_WINDOW_MS / 1000)))
      sendError(res, 429, 'Muitas tentativas de login. Tente novamente em instantes.')
    },
  })

  router.post('/register', validate({ body: registerSchema }), async (req, res) => {
    const { name, email, password } = req.body
    if (await prisma.user.findUnique({ where: { email } })) {
      return sendError(res, 409, 'Já existe uma conta com este e-mail')
    }

    const passwordHash = await hashPassword(password)
    let user
    try {
      user = await prisma.user.create({
        data: { id: randomUUID(), name, email, passwordHash, platformRole: 'USUARIO' },
      })
    } catch (error) {
      // Corrida entre duas requisições com o mesmo e-mail: o índice único decide.
      if (isUniqueViolation(error))
        return sendError(res, 409, 'Já existe uma conta com este e-mail')
      throw error
    }

    return tokenResponse(res, user, await issueTokens(user), 201)
  })

  router.post('/login', loginLimiter, validate({ body: authLoginSchema }), async (req, res) => {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    // Sempre roda o argon2, mesmo para e-mail inexistente: resposta similar (AUTH-05).
    const passwordOk = await verifyPassword(user?.passwordHash ?? null, password)
    if (!user || !passwordOk) return sendError(res, 401, INVALID_CREDENTIALS)

    return tokenResponse(res, user, await issueTokens(user))
  })

  router.post('/refresh', async (req, res) => {
    const token = readRefreshToken(req)
    if (!token) return sendError(res, 401, INVALID_SESSION)

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    })
    if (!stored) return sendError(res, 401, INVALID_SESSION)
    const user = await prisma.user.findUnique({ where: { id: stored.userId } })
    if (!user) return sendError(res, 401, INVALID_SESSION)

    return tokenResponse(res, user, await rotateRefreshToken(token, user))
  })

  router.post('/logout', async (req, res) => {
    const token = readRefreshToken(req)
    if (token) await revokeRefreshToken(token)
    clearRefreshCookie(res)
    return res.json({ message: 'Sessão encerrada' })
  })

  router.get('/me', requireAuth, meHandler)

  return router
}

/** Alias literal da issue: `GET /me` fora do prefixo `/api`. */
export const meRouter = Router()
meRouter.get('/', requireAuth, meHandler)
