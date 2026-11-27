import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Express } from 'express'
import type { DestinationStream } from 'pino'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { ensureTestOrganization } from '../test/organization.js'
import { resetTestDatabase } from '../test/reset.js'
import {
  addMembership,
  bearer,
  makeRequest,
  makeUser,
  ORGANIZATION,
  PROFILE,
  QUESTIONNAIRE,
  type Headers,
} from '../test/factories.js'
import { createApp, type AppOptions } from './app.js'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import { createLogger } from './logger.js'
import { signObjectUrl, verifyObjectToken } from './storage.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const FRONTEND_ORIGIN = 'http://localhost:5173'
const EVIL_ORIGIN = 'https://site-malicioso.example'
const PASSWORD = 'Senha@123'
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

/**
 * `createApp` recebe a configuração já transformada pelo Zod: `CORS_ORIGIN` é um
 * array de URLs (infra.test.ts usa o mesmo formato).
 */
function newApp(options: AppOptions = {}): Express {
  return createApp({
    ...options,
    config: { CORS_ORIGIN: [FRONTEND_ORIGIN], ...options.config },
  })
}

/**
 * Retry para FK transitórios: o banco de teste na nuvem pode rotear a escrita
 * recente para outra conexão, e o insert filho vira antes do pai ficar visível.
 */
async function eventually<T>(operation: () => Promise<T>, attempts = 8): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw lastError
}

/**
 * `makePet`/`makeAdoption` de test/factories.ts ainda não enviam `createdAt`,
 * obrigatório no schema atual do Prisma. Mantemos a mesma forma localmente,
 * sem alterar os helpers compartilhados nem código de produção.
 */
async function createTestPet(id: string, organization = ORGANIZATION) {
  return eventually(async () => {
    const { id: organizationId } = await ensureTestOrganization(organization, 'IP')
    return prisma.pet.create({
      data: {
        id,
        name: `Pet ${id}`,
        species: 'Cachorro',
        breed: 'SRD',
        age: 2,
        ageLabel: '2 anos',
        size: 'Médio',
        sex: 'Fêmea',
        city: 'São Paulo',
        image: 'https://example.com/pet.jpg',
        summary: 'Um pet muito querido',
        description: 'Um pet muito querido que procura um novo lar.',
        traits: ['Calmo'],
        energy: 'Moderada',
        space: 'Apartamento',
        children: true,
        otherPets: true,
        organizationId,
        status: 'DISPONIVEL',
        createdAt: new Date(),
      },
    })
  })
}

async function createTestAdoption(id: string) {
  return eventually(async () => {
    const organization = await ensureTestOrganization(ORGANIZATION, 'IP')
    const adopter = await makeUser(`${id}-adopter`)
    const admin = await makeUser(`${id}-admin`, { guardian: true })
    await addMembership(admin.user.id, ORGANIZATION)
    const pet = await createTestPet(`${id}-pet`)
    const adoptionRequest = await makeRequest(`${id}-request`, adopter.user.id, pet.id)
    const adoption = await prisma.adoption.create({
      data: {
        requestId: adoptionRequest.id,
        petId: pet.id,
        adopterId: adopter.user.id,
        organizationId: organization.id,
      },
    })
    await prisma.pet.update({ where: { id: pet.id }, data: { status: 'ADOTADO' } })
    return { adoption, adopter }
  })
}

const registerUser = (app: Express, email: string) =>
  request(app).post('/api/auth/register').send({ name: PROFILE.name, email, password: PASSWORD })

const refreshCookie = (response: { headers: Record<string, unknown> }) =>
  (response.headers['set-cookie'] as string[] | undefined)?.find((cookie) =>
    cookie.startsWith('refresh_token='),
  )

const crossOrigin = (extra: Headers = {}): Headers => ({
  Origin: EVIL_ORIGIN,
  Referer: `${EVIL_ORIGIN}/formulario`,
  ...extra,
})

const SENSITIVE_MARKERS = [
  'passwordHash',
  'tokenHash',
  'refresh_token',
  'JWT_SECRET',
  'DATABASE_URL',
  'STORAGE_SECRET_ACCESS_KEY',
  'SMTP_PASSWORD',
] as const
const STACK_TRACE = /\n?\s*at\s+[^\n(]+\([^)]*:\d+:\d+\)/
const SQL_STATEMENT = /\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM)\b/i
const FILESYSTEM_PATH = /(?:\/(?:home|root|usr|var|tmp)\/|[A-Za-z]:\\Users\\)[^\s"']+/i

function runtimeSecrets(): string[] {
  const config = loadConfig()
  return [
    config.JWT_SECRET,
    config.DATABASE_URL,
    config.STORAGE_ACCESS_KEY_ID,
    config.STORAGE_SECRET_ACCESS_KEY,
    config.SMTP_PASSWORD,
  ].filter((value): value is string => typeof value === 'string' && value.length >= 8)
}

function expectNoExposure(text: string, label: string, secrets: string[] = []) {
  for (const marker of SENSITIVE_MARKERS) {
    expect(text, `${label} não deve conter ${marker}`).not.toContain(marker)
  }
  for (const secret of secrets) {
    expect(text, `${label} não deve conter segredo lido do ambiente`).not.toContain(secret)
  }
  expect(text, `${label} não deve conter stack trace`).not.toMatch(STACK_TRACE)
  expect(text, `${label} não deve conter SQL`).not.toMatch(SQL_STATEMENT)
  expect(text, `${label} não deve conter caminho de arquivo`).not.toMatch(FILESYSTEM_PATH)
}

describe('exposição de segurança: CSRF em origens não autorizadas (#131)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  databaseSuite('com banco de teste', () => {
    let app: Express

    beforeEach(async () => {
      await resetTestDatabase()
      // App nova por teste: o limite de requisições é estado local do middleware.
      app = newApp()
    })

    afterEach(resetTestDatabase)

    it('[CSRF-01] cookie de refresh sozinho não autoriza escrita cross-origin', async () => {
      const cookie = refreshCookie(await registerUser(app, 'csrf-01@exemplo.com'))
      expect(cookie).toBeTruthy()
      const owner = await makeUser('csrf-01-owner')
      const pet = await createTestPet('csrf-01-pet')

      const requestsBefore = await prisma.adoptionRequest.count()
      const favoritesBefore = await prisma.favorite.count()
      const originalName = owner.user.name

      const account = await request(app)
        .put('/api/me/account')
        .set(crossOrigin())
        .set('Cookie', cookie!)
        .send({ accountType: 'adopter', name: 'Nome Forjado' })
      const adoptionRequest = await request(app)
        .post('/api/requests')
        .set(crossOrigin())
        .set('Cookie', cookie!)
        .send({ petId: pet.id, message: 'Solicitação forjada', answers: QUESTIONNAIRE })
      const favorite = await request(app)
        .put(`/api/me/favorites/${pet.id}`)
        .set(crossOrigin())
        .set('Cookie', cookie!)

      for (const response of [account, adoptionRequest, favorite]) {
        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Unauthorized')
        // Nenhuma resposta de outra origem é legível pelo navegador.
        expect(response.headers['access-control-allow-origin']).toBeUndefined()
      }

      expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).name).toBe(
        originalName,
      )
      expect(await prisma.adoptionRequest.count()).toBe(requestsBefore)
      expect(await prisma.favorite.count()).toBe(favoritesBefore)
    })

    it('[CSRF-02] formulário cross-origin exige Bearer; cookie não autoriza', async () => {
      const cookie = refreshCookie(await registerUser(app, 'csrf-02@exemplo.com'))
      expect(cookie).toBeTruthy()
      const owner = await makeUser('csrf-02-owner')
      const pet = await createTestPet('csrf-02-pet')
      const before = await prisma.favorite.count()

      // application/x-www-form-urlencoded é um "simple request": o navegador envia
      // o cookie, mas a API não usa cookie para autorizar escrita (AUTH-18/CSRF-01).
      const form = await request(app)
        .put(`/api/me/favorites/${pet.id}`)
        .set(crossOrigin())
        .set('Cookie', cookie!)
        .type('form')
        .send({ petId: pet.id })

      expect(form.status).toBe(401)
      expect(form.headers['access-control-allow-origin']).toBeUndefined()
      expect(await prisma.favorite.count()).toBe(before)

      // Limitação conhecida: não há token CSRF para requisições autenticadas por
      // Bearer. A proteção é o token não vir de cookie + CORS (resposta ilegível).
      const authorized = await request(app)
        .put(`/api/me/favorites/${pet.id}`)
        .set(crossOrigin())
        .set(owner.headers)
        .type('form')
        .send({ petId: pet.id })

      expect(authorized.status).toBe(204)
      expect(authorized.headers['access-control-allow-origin']).toBeUndefined()
      expect(await prisma.favorite.count()).toBe(before + 1)
    })

    it('[CSRF-03] X-Demo-User-Id/X-Demo-Role de outra origem não escalam privilégio', async () => {
      const attacker = await makeUser('csrf-03-attacker')
      const cookie = refreshCookie(await registerUser(app, 'csrf-03@exemplo.com'))
      const before = await prisma.organization.count()

      // AUTH-18 já cobre X-Demo-User-Id isolado em GET /api/me. Aqui testamos a
      // combinação com cookie e papel privilegiado em uma rota de escrita.
      const response = await request(app)
        .post('/api/organizations')
        .set(
          crossOrigin({
            'X-Demo-User-Id': attacker.user.id,
            'X-Demo-Role': 'MODERADOR',
          }),
        )
        .set('Cookie', cookie!)
        .send({ name: 'ONG Forjada', initials: 'OF' })

      expect(response.status).toBe(401)
      expect(response.headers['access-control-allow-origin']).toBeUndefined()
      expect(await prisma.organization.count()).toBe(before)
    })

    it('[CSRF-04] preflight de origem não autorizada não libera CORS', async () => {
      const blocked = await request(app)
        .options('/api/me/account')
        .set('Origin', EVIL_ORIGIN)
        .set('Access-Control-Request-Method', 'PUT')
        .set('Access-Control-Request-Headers', 'content-type,authorization,x-demo-role')

      expect(blocked.status).toBe(204)
      // O middleware ainda ecoa methods/headers, mas sem `Access-Control-Allow-Origin`
      // o navegador aborta o preflight: a origem não autorizada não é liberada.
      expect(blocked.headers['access-control-allow-origin']).toBeUndefined()

      const allowed = await request(app)
        .options('/api/me/account')
        .set('Origin', FRONTEND_ORIGIN)
        .set('Access-Control-Request-Method', 'PUT')
        .set('Access-Control-Request-Headers', 'content-type,authorization')

      expect(allowed.status).toBe(204)
      expect(allowed.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
      expect(allowed.headers['access-control-allow-methods']).toContain('PUT')
    })

    it('[CSRF-05] refresh/logout cross-origin não passam a ser lidos pelo navegador', async () => {
      const cookie = refreshCookie(await registerUser(app, 'csrf-05@exemplo.com'))
      expect(cookie).toBeTruthy()

      const withoutCookie = await request(app).post('/api/auth/refresh').set(crossOrigin())
      expect(withoutCookie.status).toBe(401)
      expect(withoutCookie.headers['access-control-allow-origin']).toBeUndefined()

      // Limitação do contrato atual: refresh/logout usam o cookie como credencial
      // e não verificam Origin no servidor. A defesa é SameSite=Lax + CORS: um
      // script de outra origem não lê a resposta nem envia o cookie cross-site.
      const refreshed = await request(app)
        .post('/api/auth/refresh')
        .set(crossOrigin())
        .set('Cookie', cookie!)

      expect(refreshed.status).toBe(200)
      expect(refreshed.headers['access-control-allow-origin']).toBeUndefined()
      const rotated = refreshCookie(refreshed)
      expect(rotated).toMatch(/^refresh_token=/)
      expect(rotated).toMatch(/HttpOnly/i)
      expect(rotated).toMatch(/Secure/i)
      expect(rotated).toMatch(/SameSite=Lax/i)

      const logout = await request(app)
        .post('/api/auth/logout')
        .set(crossOrigin())
        .set('Cookie', rotated!)

      expect(logout.status).toBe(200)
      expect(logout.headers['access-control-allow-origin']).toBeUndefined()
      expect((await request(app).post('/api/auth/refresh').set('Cookie', rotated!)).status).toBe(
        401,
      )
    })
  })
})

describe('exposição de informações: segredos em respostas logs e repositório (#132)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[INFO-01] rotas públicas e /docs não devolvem segredos nem detalhes internos', async () => {
    const app = newApp()
    const secretInjectedInSearch = encodeURIComponent(loadConfig().JWT_SECRET)
    const paths = [
      '/health',
      '/api/pets',
      `/api/pets?search=${secretInjectedInSearch}`,
      '/api/pets/pet-inexistente',
      '/api/rota-inexistente',
      '/docs/',
      '/docs/openapi.json',
    ]

    for (const path of paths) {
      const response = await request(app).get(path)
      const text = `${JSON.stringify(response.body)}\n${response.text ?? ''}`

      expectNoExposure(text, `GET ${path}`, runtimeSecrets())
      expect(response.headers['set-cookie'], `GET ${path}`).toBeUndefined()
    }
  })

  it('[INFO-04] logs não registram senha, token ou CPF (extensão de INF-08)', async () => {
    const lines: string[] = []
    const destination = {
      write: (chunk: string) => {
        lines.push(chunk)
        return true
      },
    } as DestinationStream
    const logger = createLogger({ level: 'debug', destination })
    const app = newApp({ logger })

    const password = 'SenhaSuperSecretaInfo04@123'
    const cpf = '52998224725'
    const token = 'token-super-secreto-info-04'

    const response = await request(app)
      .put('/api/me/account')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', `refresh_token=${token}`)
      .send({
        accountType: 'adopter',
        name: 'Ana Souza',
        password,
        cpf,
        profile: { password, cpf },
        answers: [{ token, cpf }],
      })

    expect(response.status).toBe(401)
    expect(response.headers['x-request-id']).toBeTruthy()

    // A rota de erro 500 também usa o mesmo logger; o Bearer continua redigido.
    vi.spyOn(prisma.pet, 'findMany').mockRejectedValueOnce(new Error('falha interna genérica'))
    const failed = await request(app).get('/api/pets').set('Authorization', `Bearer ${token}`)
    expect(failed.status).toBe(500)

    const logs = lines.join('\n')
    expect(logs).toContain('requestId')
    expect(logs).toContain(String(response.headers['x-request-id']))
    for (const value of [password, cpf, token, `refresh_token=${token}`]) {
      expect(logs, `log não deve conter ${value}`).not.toContain(value)
    }
    // Limitação conhecida: `url` é registrado sem redação, então valores sensíveis
    // não devem ser enviados na query string (INF-08 cobre apenas body/headers).
  })

  it('[INFO-05] URLs assinadas expiram e fontes versionadas não contêm credenciais', async () => {
    const config = loadConfig()
    const secret = config.STORAGE_URL_SECRET ?? config.JWT_SECRET
    const objectId = 'info-05-objeto'
    const tokenOf = (url: string) => new URL(url, FRONTEND_ORIGIN).searchParams.get('token') ?? ''

    const expired = await signObjectUrl(objectId, -10, secret)
    expect(expired.url).toMatch(/^\/files\/info-05-objeto\?token=/)
    expect(expired.url).not.toContain(secret)
    await expect(verifyObjectToken(tokenOf(expired.url), objectId, secret)).rejects.toMatchObject({
      statusCode: 403,
    })

    const valid = await signObjectUrl(objectId, 60, secret)
    await expect(verifyObjectToken(tokenOf(valid.url), objectId, secret)).resolves.toBeUndefined()
    await expect(
      verifyObjectToken(tokenOf(valid.url), 'outro-objeto', secret),
    ).rejects.toMatchObject({ statusCode: 403 })
    // A expiração/posse da URL pela rota /files/:id já é coberta por STO-02/03/06.

    // Varredura leve do que é versionado (sem depender de build): valores reais
    // lidos do ambiente e formatos conhecidos de credencial não podem aparecer
    // em código-fonte ou no .env.example de placeholders.
    const files: string[] = []
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'generated' || entry.name === 'node_modules' || entry.name === 'dist') {
          continue
        }
        const full = join(dir, entry.name)
        if (entry.isDirectory()) visit(full)
        else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
          files.push(full)
        }
      }
    }
    visit(join(repoRoot, 'apps/api/src'))
    visit(join(repoRoot, 'apps/api/prisma'))
    files.push(join(repoRoot, 'apps/api/.env.example'))

    expect(files.length).toBeGreaterThan(10)
    const credentials = [
      /\bAKIA[0-9A-Z]{16}\b/,
      /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
      /\bsk_live_[A-Za-z0-9]{16,}\b/,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      /postgresql:\/\/[^/\s:"']+:[^@\s:"']+@(?!host\b)/,
    ]

    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      for (const secret of runtimeSecrets()) {
        expect(content, `${file} não deve conter segredo real`).not.toContain(secret)
      }
      for (const pattern of credentials) {
        expect(content, `${file} não deve conter credencial ${pattern}`).not.toMatch(pattern)
      }
    }
  })
})

databaseSuite('respostas autenticadas e erros com banco (#132)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = newApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
    vi.restoreAllMocks()
  })

  it('[INFO-02] listas de perfil pets solicitações e adoções não expõem segredos', async () => {
    const registered = await registerUser(app, 'info-02-register@exemplo.com')
    expect(registered.status).toBe(201)
    // Outros suítes podem estar usando o mesmo banco de teste em paralelo;
    // filtramos pelo usuário recém-criado em vez de contar a tabela inteira.
    const stored = await prisma.refreshToken.findFirstOrThrow({
      where: { userId: registered.body.user.id as string },
    })
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(refreshCookie(registered)).not.toContain(stored.tokenHash)
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: 'info-02-register@exemplo.com' } }))
        .passwordHash,
    ).toMatch(/^\$argon2id\$/)

    const adopter = await makeUser('info-02-adopter')
    // Não existe makeGuardian em test/factories.ts: o helper é makeUser({ guardian: true }).
    const guardian = await makeUser('info-02-guardian', { guardian: true })
    const pet = await createTestPet('info-02-pet')
    const adoptionRequest = await eventually(() =>
      makeRequest('info-02-request', adopter.user.id, pet.id, { answers: QUESTIONNAIRE }),
    )
    const adoption = await createTestAdoption('info-02-adoption')

    const cases = [
      await request(app).get('/api/auth/me').set(bearer(registered.body.accessToken)),
      await request(app).get('/api/me').set(adopter.headers),
      await request(app).get('/api/me/adopter-profile').set(adopter.headers),
      await request(app).get('/api/me/guardian-profile').set(guardian.headers),
      await request(app).get('/api/me/favorites').set(adopter.headers),
      await request(app).get('/api/me/requests').set(adopter.headers),
      await request(app).get(`/api/requests/${adoptionRequest.id}`).set(adopter.headers),
      await request(app).get(`/api/pets/${pet.id}`).set(adopter.headers),
      await request(app).get('/api/me/adoptions').set(adoption.adopter.headers),
    ]

    for (const [index, response] of cases.entries()) {
      expect(response.status, `resposta ${index}`).toBeLessThan(500)
      expectNoExposure(
        JSON.stringify(response.body),
        `resposta autenticada ${index}`,
        runtimeSecrets(),
      )
    }
  })

  it('[INFO-03] erros 4xx/5xx são genéricos e não vazam SQL, stack ou caminhos', async () => {
    const outsider = await makeUser('info-03-outsider')
    const pet = await createTestPet('info-03-pet')
    const owner = await makeUser('info-03-owner')
    const adoptionRequest = await eventually(() =>
      makeRequest('info-03-request', owner.user.id, pet.id),
    )

    const internal = `${loadConfig().JWT_SECRET} SELECT * FROM "User" /home/dev/apps/api/src/auth.ts`
    vi.spyOn(prisma.pet, 'findMany').mockRejectedValueOnce(new Error(internal))
    const downApp = newApp({ checkDatabase: async () => false })

    const cases = [
      { label: '400', response: await request(app).get('/api/pets?page=abc') },
      { label: '401', response: await request(app).get('/api/me') },
      {
        label: '403',
        response: await request(app)
          .get(`/api/requests/${adoptionRequest.id}`)
          .set(outsider.headers),
      },
      { label: '404', response: await request(app).get('/api/rota-inexistente') },
      { label: '503', response: await request(downApp).get('/health') },
      { label: '500', response: await request(app).get('/api/pets') },
    ]

    for (const { label, response } of cases) {
      expect(response.status, label).toBe(Number(label))
      expectNoExposure(JSON.stringify(response.body), `erro ${label}`, runtimeSecrets())
    }
    expect(cases[5].response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor',
    })
  })
})
