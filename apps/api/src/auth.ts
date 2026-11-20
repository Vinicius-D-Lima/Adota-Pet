import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { hash, verify } from '@node-rs/argon2'
import { decodeJwt, jwtVerify, SignJWT } from 'jose'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import { HttpError } from './http.js'
import type { User } from './generated/prisma/client.js'

/** Identidade preenchida por `requireAuth` e reutilizada pelos próximos módulos. */
export type PlatformRole = 'USUARIO' | 'MODERADOR'
export interface AuthenticatedIdentity {
  userId: string
  platformRole: PlatformRole
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Usuário autenticado (inclui campos do banco; nunca serializar direto). */
    user?: User
    /** Claims mínimos do access token. */
    auth?: AuthenticatedIdentity
  }
}

const ISSUER = 'adotapet-api'
const AUDIENCE = 'adotapet-web'
const MS_PER_DAY = 86_400_000

/** Hash "custo zero" para igualar o tempo de resposta de e-mail inexistente (AUTH-05). */
let dummyPasswordHash: Promise<string> | undefined
const dummyHash = () => (dummyPasswordHash ??= hash('senha-inexistente-usada-apenas-para-tempo'))

const secretKey = () => new TextEncoder().encode(loadConfig().JWT_SECRET)

/** Argon2id: prefixo `$argon2id$` conferido por AUTH-04. */
export const hashPassword = (password: string) => hash(password)

export async function verifyPassword(passwordHash: string | null, password: string) {
  const expected = passwordHash ?? (await dummyHash())
  try {
    return await verify(expected, password)
  } catch {
    return false
  }
}

export async function signAccessToken(user: Pick<User, 'id' | 'platformRole'>) {
  const token = await new SignJWT({ type: 'access', platformRole: user.platformRole })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(loadConfig().JWT_ACCESS_TTL)
    .sign(secretKey())

  const claims = decodeJwt(token)
  return { token, expiresIn: Number(claims.exp) - Number(claims.iat) }
}

/**
 * `algorithms: ['HS256']` fixo: `alg: none` e troca de algoritmo são rejeitados
 * antes mesmo de qualquer claim ser lido (AUTH-09/AUTH-10).
 */
export async function verifyAccessToken(token: string): Promise<AuthenticatedIdentity> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Claims de access token inválidos')
  }
  return {
    userId: payload.sub,
    platformRole: payload.platformRole === 'MODERADOR' ? 'MODERADOR' : 'USUARIO',
  }
}

/** Token opaco de alta entropia; o banco guarda apenas o SHA-256 dele (AUTH-16). */
export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

const refreshMaxAge = () => loadConfig().JWT_REFRESH_TTL_DAYS * MS_PER_DAY

export async function createRefreshToken(userId: string) {
  const token = randomBytes(48).toString('base64url')
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + refreshMaxAge()),
    },
  })
  return token
}

const cookieOptions = () => {
  const config = loadConfig()
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
    path: '/',
    maxAge: refreshMaxAge(),
  }
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(loadConfig().REFRESH_COOKIE_NAME, token, cookieOptions())
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(loadConfig().REFRESH_COOKIE_NAME, cookieOptions())
}

export function readRefreshToken(req: Request): string | undefined {
  const name = loadConfig().REFRESH_COOKIE_NAME
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key !== name) continue
    const raw = value.join('=')
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return undefined
}

/** Conjunto completo devolvido por register/login/refresh. */
export async function issueTokens(user: User) {
  const access = await signAccessToken(user)
  const refreshToken = await createRefreshToken(user.id)
  return { accessToken: access.token, expiresIn: access.expiresIn, refreshToken }
}

/**
 * O `updateMany` condicional é atômico: dois pedidos concorrentes com o mesmo
 * refresh não geram dois tokens válidos.
 */
export async function rotateRefreshToken(token: string, user: User) {
  const tokenHash = hashRefreshToken(token)
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } })
  if (!stored || stored.userId !== user.id) throw new HttpError(401, 'Sessão inválida')

  if (stored.revokedAt) {
    // Reuso detectado: revoga toda a cadeia deste usuário (AUTH-12).
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    throw new HttpError(401, 'Sessão inválida')
  }
  if (stored.expiresAt <= new Date()) throw new HttpError(401, 'Sessão inválida')

  const revoked = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (revoked.count !== 1) throw new HttpError(401, 'Sessão inválida')

  return issueTokens(user)
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Middleware reutilizável: valida o Bearer e preenche `req.auth` e `req.user`. */
export async function requireAuth(req: Request, _res: Response, next: (error?: unknown) => void) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('Authorization') ?? '')
  if (!match) return next(new HttpError(401, 'Autenticação necessária'))

  try {
    const identity = await verifyAccessToken(match[1])
    const user = await prisma.user.findUnique({ where: { id: identity.userId } })
    if (!user) return next(new HttpError(401, 'Autenticação necessária'))
    req.auth = identity
    req.user = user
    next()
  } catch {
    next(new HttpError(401, 'Autenticação necessária'))
  }
}
