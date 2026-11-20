import { Buffer } from 'node:buffer'
import type { Express } from 'express'
import { decodeJwt, SignJWT } from 'jose'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { prisma } from './db.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const PASSWORD = 'Senha@123'

const register = (app: Express, email = 'ana@exemplo.com') =>
  request(app).post('/api/auth/register').send({ name: 'Ana Souza', email, password: PASSWORD })

const login = (app: Express, email = 'ana@exemplo.com', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password })

const refreshCookie = (response: { headers: Record<string, unknown> }) =>
  (response.headers['set-cookie'] as string[] | undefined)?.find((cookie) =>
    cookie.startsWith('refresh_token='),
  )

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

databaseSuite('autenticação (#48)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    // App nova por teste: o rate limit de login é estado local do middleware.
    app = createApp()
  })

  afterEach(resetTestDatabase)

  it('[AUTH-01] cadastro normaliza o e-mail', async () => {
    const response = await register(app, 'Ana@Exemplo.COM')

    expect(response.status).toBe(201)
    expect(response.body.user.email).toBe('ana@exemplo.com')
    expect(await prisma.user.findUnique({ where: { email: 'ana@exemplo.com' } })).not.toBeNull()
  })

  it('[AUTH-02] e-mail repetido retorna 409', async () => {
    expect((await register(app)).status).toBe(201)

    const repeated = await register(app, 'ANA@EXEMPLO.COM')
    expect(repeated.status).toBe(409)
    expect(repeated.body).toMatchObject({ statusCode: 409, error: 'Conflict' })
    expect(await prisma.user.count()).toBe(1)
  })

  it('[AUTH-03] senha curta ou e-mail inválido retorna 400', async () => {
    const short = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Souza', email: 'ana@exemplo.com', password: 'curta' })
    expect(short.status).toBe(400)
    expect(short.body).toMatchObject({ statusCode: 400, error: 'Bad Request' })
    expect(short.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
    )

    const invalidEmail = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Souza', email: 'nao-e-email', password: PASSWORD })
    expect(invalidEmail.status).toBe(400)
    expect(invalidEmail.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    )
  })

  it('[AUTH-04] senha com argon2 e passwordHash nunca exposto', async () => {
    const created = await register(app)
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'ana@exemplo.com' },
    })

    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    expect(user.passwordHash).not.toBe(PASSWORD)
    expect(JSON.stringify(created.body)).not.toContain('passwordHash')
    expect(JSON.stringify(created.body)).not.toContain(PASSWORD)

    const logged = await login(app)
    const me = await request(app).get('/api/auth/me').set(bearer(logged.body.accessToken))
    const failed = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana Souza', email: 'ana@exemplo.com', password: PASSWORD })

    for (const body of [logged.body, me.body, failed.body]) {
      expect(JSON.stringify(body)).not.toContain('passwordHash')
      expect(JSON.stringify(body)).not.toContain(PASSWORD)
    }
  })

  it('[AUTH-05] login não revela se o e-mail existe', async () => {
    await register(app)

    const startWrongPassword = performance.now()
    const wrongPassword = await login(app, 'ana@exemplo.com', 'senha-errada')
    const wrongPasswordMs = performance.now() - startWrongPassword

    const startUnknownEmail = performance.now()
    const unknownEmail = await login(app, 'ninguem@exemplo.com', 'senha-errada')
    const unknownEmailMs = performance.now() - startUnknownEmail

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message)
    expect(wrongPassword.body.message).toMatch(/credenciais inválidas/i)
    // argon2 roda nos dois caminhos: nenhum dos dois é "barato" o bastante para enumeração.
    expect(Math.abs(wrongPasswordMs - unknownEmailMs)).toBeLessThan(1000)
  })

  it('[AUTH-06] 6ª tentativa de login em 1 minuto retorna 429', async () => {
    const limited = createApp({
      config: { LOGIN_RATE_LIMIT_MAX: 5, LOGIN_RATE_LIMIT_WINDOW_MS: 60_000 },
    })
    await register(limited)

    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await login(limited, 'ana@exemplo.com', 'errada')).status).toBe(401)
    }
    const sixth = await login(limited, 'ana@exemplo.com', 'errada')
    expect(sixth.status).toBe(429)
    expect(sixth.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' })
    expect(sixth.headers['retry-after']).toBeDefined()
  })

  it('[AUTH-07] login emite access token curto e cookie de refresh', async () => {
    await register(app)
    const response = await login(app)

    expect(response.status).toBe(200)
    expect(response.body.accessToken).toBeTruthy()
    const claims = decodeJwt(response.body.accessToken)
    expect(Number(claims.exp) - Number(claims.iat)).toBeLessThanOrEqual(900)
    expect(Number(claims.exp) - Number(claims.iat)).toBeGreaterThan(0)
    expect(response.body.expiresIn).toBeLessThanOrEqual(900)
    expect(refreshCookie(response)).toMatch(/^refresh_token=/)
  })

  it('[AUTH-08] cookie de refresh com flags de segurança', async () => {
    const created = await register(app)
    const cookie = refreshCookie(created) ?? ''

    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).not.toContain(created.body.accessToken)
  })

  it('[AUTH-09] JWT adulterado é rejeitado', async () => {
    await register(app)
    const { accessToken } = (await login(app)).body
    const [header, payload, signature] = accessToken.split('.')
    const tamperedSignature = (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1)
    const tampered = `${header}.${payload}.${tamperedSignature}`

    const response = await request(app).get('/api/auth/me').set(bearer(tampered))
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Unauthorized')
  })

  it('[AUTH-10] JWT com alg none ou algoritmo inesperado é rejeitado', async () => {
    await register(app)
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@exemplo.com' } })
    const key = new TextEncoder().encode(loadConfig().JWT_SECRET)
    const claims = { sub: user.id, type: 'access', platformRole: 'USUARIO' }

    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
    const algNone = `${header}.${body}.`

    const hs384 = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS384' })
      .setIssuer('adotapet-api')
      .setAudience('adotapet-web')
      .setExpirationTime('15m')
      .sign(key)

    for (const token of [algNone, hs384]) {
      const response = await request(app).get('/api/auth/me').set(bearer(token))
      expect(response.status).toBe(401)
    }
  })

  it('[AUTH-11] JWT expirado é rejeitado', async () => {
    await register(app)
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@exemplo.com' } })
    const expired = await new SignJWT({ type: 'access', platformRole: 'USUARIO' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('adotapet-api')
      .setAudience('adotapet-web')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime('-1s')
      .sign(new TextEncoder().encode(loadConfig().JWT_SECRET))

    const response = await request(app).get('/api/auth/me').set(bearer(expired))
    expect(response.status).toBe(401)
  })

  it('[AUTH-12] refresh rotacionado e reuso detectado', async () => {
    const created = await register(app)
    const first = refreshCookie(created) ?? ''
    expect(first).toBeTruthy()

    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', first)
    expect(rotated.status).toBe(200)
    const second = refreshCookie(rotated) ?? ''
    expect(second).toBeTruthy()
    expect(second).not.toBe(first)

    const reused = await request(app).post('/api/auth/refresh').set('Cookie', first)
    expect(reused.status).toBe(401)

    // Reuso revoga a cadeia inteira, incluindo o token mais novo.
    const chain = await request(app).post('/api/auth/refresh').set('Cookie', second)
    expect(chain.status).toBe(401)
  })

  it('[AUTH-13] logout invalida o refresh', async () => {
    const created = await register(app)
    const cookie = refreshCookie(created) ?? ''

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie)
    expect(logout.status).toBe(200)

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refreshed.status).toBe(401)
  })

  it('[AUTH-14] cadastro ignora campos privilegiados', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: PASSWORD,
      id: 'id-forjado',
      platformRole: 'MODERADOR',
      passwordHash: 'hash-forjado',
      createdAt: '1999-01-01T00:00:00.000Z',
    })

    expect(response.status).toBe(201)
    expect(response.body.user.id).not.toBe('id-forjado')
    expect(response.body.user.platformRole).toBe('USUARIO')

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@exemplo.com' } })
    expect(user.platformRole).toBe('USUARIO')
    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    expect(user.passwordHash).not.toBe('hash-forjado')
  })

  it('[AUTH-15] rota protegida exige token', async () => {
    const unauthenticated = await request(app).get('/api/auth/me')
    expect(unauthenticated.status).toBe(401)
    expect(unauthenticated.body.error).toBe('Unauthorized')

    const { accessToken } = (await register(app)).body
    const authenticated = await request(app).get('/api/auth/me').set(bearer(accessToken))
    expect(authenticated.status).toBe(200)
    expect(authenticated.body.email).toBe('ana@exemplo.com')

    const alias = await request(app).get('/me').set(bearer(accessToken))
    expect(alias.status).toBe(200)
    expect(alias.body.email).toBe('ana@exemplo.com')
  })

  it('[AUTH-16] refresh token guardado só como hash', async () => {
    const created = await register(app)
    const cookie = refreshCookie(created) ?? ''
    const rawToken = cookie.split(';')[0].replace(/^refresh_token=/, '')

    expect(rawToken.length).toBeGreaterThan(40)
    const stored = await prisma.refreshToken.findMany()
    expect(stored).toHaveLength(1)
    expect(stored[0].tokenHash).not.toBe(rawToken)
    expect(JSON.stringify(stored)).not.toContain(rawToken)
    expect(stored[0].tokenHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('[AUTH-20] cadastro de adotante popula o perfil exibido na tela', async () => {
    const created = await register(app)
    const token = created.body.accessToken
    const account = {
      accountType: 'adopter',
      name: 'Ana Souza',
      cpf: '52998224725',
      birthDate: '1990-05-10',
      email: 'ana@exemplo.com',
      phone: '11999999999',
      zipCode: '01310100',
      address: 'Rua das Flores, 100',
      password: PASSWORD,
    }

    expect(
      (await request(app).put('/api/me/account').set(bearer(token)).send(account)).status,
    ).toBe(200)
    const profile = await request(app).get('/api/me/adopter-profile').set(bearer(token))
    expect(profile.status).toBe(200)
    expect(profile.body).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      cpf: '52998224725',
      birthDate: '1990-05-10',
    })
  })

  it('[AUTH-21] cadastro de instituição popula o perfil de responsável', async () => {
    const created = await register(app, 'ong@patinhas.org')
    const token = created.body.accessToken
    const account = {
      accountType: 'guardian',
      guardianType: 'ORGANIZATION',
      organizationName: 'Instituto Patinhas',
      responsibleName: 'Maria da Silva',
      document: '11222333000181',
      email: 'ong@patinhas.org',
      phone: '11999999999',
      zipCode: '01310100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      password: PASSWORD,
    }

    expect(
      (await request(app).put('/api/me/account').set(bearer(token)).send(account)).status,
    ).toBe(200)
    const profile = await request(app).get('/api/me/guardian-profile').set(bearer(token))
    expect(profile.status).toBe(200)
    expect(profile.body).toMatchObject({
      guardianType: 'ORGANIZATION',
      displayName: 'Instituto Patinhas',
      legalName: 'Maria da Silva',
      document: '11222333000181',
      email: 'ong@patinhas.org',
      city: 'São Paulo, SP',
      acceptsTerms: true,
    })
  })

  it('[AUTH-22] perfil de conta antiga usa os dados do cadastro como fallback', async () => {
    // Contas criadas antes da sincronização com as tabelas de perfil têm
    // AdopterProfile vazio, mas o nome/e-mail ficaram em User.
    const created = await register(app, 'antiga@exemplo.com')
    const token = created.body.accessToken

    const profile = await request(app).get('/api/me/adopter-profile').set(bearer(token))
    expect(profile.status).toBe(200)
    expect(profile.body).toMatchObject({
      name: 'Ana Souza',
      email: 'antiga@exemplo.com',
    })
    expect(profile.body.isComplete).toBe(false)
  })
})

/**
 * Proteção das rotas legadas (#4/#5). Não depende de banco: o middleware
 * `requireAuth` roda antes de qualquer acesso ao Prisma.
 */
describe('proteção das rotas privadas (#4/#5)', () => {
  const app = createApp({ checkDatabase: async () => true })

  it.each([
    '/api/me',
    '/api/me/account',
    '/api/me/adopter-profile',
    '/api/me/guardian-profile',
    '/api/me/favorites',
    '/api/me/saved-filters',
    '/api/me/notifications',
    '/api/me/permissions',
    '/api/me/organization-pets',
    '/api/me/requests',
    '/api/requests',
    '/api/requests/SOL-1',
  ])('[AUTH-17] %s exige token', async (path) => {
    const response = await request(app).get(path)
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Unauthorized')
  })

  it('[AUTH-18] cabeçalho demo não autentica a API real', async () => {
    const response = await request(app).get('/api/me').set('X-Demo-User-Id', 'demo')
    expect(response.status).toBe(401)
  })

  it('[AUTH-19] rotas públicas continuam abertas e o 404 é preservado', async () => {
    expect((await request(app).get('/health')).status).toBe(200)
    const unknown = await request(app).get('/api/rota-inexistente')
    expect(unknown.status).toBe(404)
  })
})
