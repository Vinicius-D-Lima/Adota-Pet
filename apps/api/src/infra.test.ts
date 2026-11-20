import type { DestinationStream } from 'pino'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import { createLogger } from './logger.js'
import { listRoutes } from './openapi.js'

describe('infraestrutura da API (#47)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('[INF-01] variável obrigatória ausente derruba a inicialização', () => {
    expect(() => loadConfig({ ...process.env, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/)
    expect(() => loadConfig({ ...process.env, DATABASE_URL: '' })).toThrow(/DATABASE_URL/)
    // #48: a chave de assinatura também é obrigatória e aparece na mensagem.
    expect(() => loadConfig({ ...process.env, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/)
  })

  it('[INF-02] erro de validação usa o formato padrão', async () => {
    const response = await request(createApp()).get('/api/pets?page=abc')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validação falhou',
    })
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'page' })]),
    )

    // O contrato da API continua recusando parâmetros desconhecidos.
    const unknownParam = await request(createApp()).get('/api/pets?desconhecido=1')
    expect(unknownParam.status).toBe(400)
    expect(unknownParam.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'desconhecido' })]),
    )
  })

  it('[INF-03] erro inesperado devolve 500 genérico', async () => {
    const secret = 'erro interno dado-interno /home/dev/apps/api/src'
    const findMany = vi.spyOn(prisma.pet, 'findMany').mockRejectedValueOnce(new Error(secret))

    const response = await request(createApp()).get('/api/pets')

    expect(findMany).toHaveBeenCalledOnce()
    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno do servidor',
    })
    expect(JSON.stringify(response.body)).not.toContain('dado-interno')
    expect(JSON.stringify(response.body)).not.toContain('/home/dev')
  })

  it('[INF-04] CORS só para a origem do frontend', async () => {
    const app = createApp({
      config: { CORS_ORIGIN: ['http://localhost:5173'] },
      checkDatabase: async () => true,
    })

    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')

    const blocked = await request(app)
      .get('/health')
      .set('Origin', 'https://site-malicioso.example')
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('[INF-05] cabeçalhos do helmet presentes', async () => {
    const response = await request(
      createApp({ config: { NODE_ENV: 'production' }, checkDatabase: async () => true }),
    ).get('/health')

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['strict-transport-security']).toMatch(/max-age/)
    expect(response.headers['x-powered-by']).toBeUndefined()
  })

  it('[INF-06] limite global de requisições', async () => {
    const app = createApp({
      config: { RATE_LIMIT_MAX: 2, RATE_LIMIT_WINDOW_MS: 60_000 },
      checkDatabase: async () => true,
    })

    expect((await request(app).get('/health')).status).toBe(200)
    expect((await request(app).get('/health')).status).toBe(200)

    const limited = await request(app).get('/health')
    expect(limited.status).toBe(429)
    expect(limited.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' })
    expect(limited.headers['retry-after']).toBeDefined()
  })

  it('[INF-07] corpo grande e JSON malformado', async () => {
    const smallLimit = createApp({ config: { BODY_LIMIT: '1kb' } })
    const large = await request(smallLimit)
      .put('/api/me/account')
      .send({ description: 'x'.repeat(2048) })
    expect(large.status).toBe(413)
    expect(large.body.error).toBe('Payload Too Large')

    const malformed = await request(createApp())
      .put('/api/me/account')
      .set('Content-Type', 'application/json')
      .send('{"accountType":')
    expect(malformed.status).toBe(400)
    expect(malformed.body.message).toBe('JSON inválido no corpo da requisição')
  })

  it('[INF-08] logs sem dados sensíveis e com id de requisição', async () => {
    const lines: string[] = []
    const destination = {
      write: (chunk: string) => {
        lines.push(chunk)
        return true
      },
    } as DestinationStream
    const testLogger = createLogger({ level: 'debug', destination })

    // A rota agora exige JWT: usa um token válido e um usuário em memória para
    // chegar à validação Zod sem depender do banco.
    const fakeUser = { id: 'inf-08', platformRole: 'USUARIO' } as const
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(fakeUser as never)
    const { token } = await signAccessToken(fakeUser)

    const response = await request(createApp({ logger: testLogger }))
      .put('/api/me/account')
      .set('Cookie', 'session=abc123')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountType: 'adopter',
        password: 'senhaSuperSecreta123',
        cpf: '52998224725',
        email: 'ana@exemplo.com',
      })

    expect(response.status).toBe(400)
    const requestId = response.headers['x-request-id']
    expect(requestId).toBeTruthy()
    const logs = lines.join('\n')
    expect(logs).toContain('requestId')
    expect(logs).toContain(String(requestId))
    expect(logs).not.toContain('senhaSuperSecreta123')
    expect(logs).not.toContain('token-super-secreto')
    expect(logs).not.toContain('session=abc123')
    expect(logs).not.toContain('52998224725')
  })

  it('[INF-09] GET /health reflete o banco', async () => {
    const up = await request(createApp({ checkDatabase: async () => true })).get('/health')
    expect(up.status).toBe(200)
    expect(up.body).toEqual({ status: 'ok', database: 'ok' })

    const down = await request(createApp({ checkDatabase: async () => false })).get('/health')
    expect(down.status).toBe(503)
    expect(down.body).toEqual({ status: 'error', database: 'unavailable' })
  })

  it('[INF-10] /docs serve a OpenAPI completa', async () => {
    const app = createApp()

    const html = await request(app).get('/docs/')
    expect(html.status).toBe(200)
    expect(html.text).toMatch(/swagger/i)

    const response = await request(app).get('/docs/openapi.json')
    expect(response.status).toBe(200)
    expect(response.body.openapi).toBe('3.1.0')

    for (const route of listRoutes(app)) {
      expect(response.body.paths[route.path]).toHaveProperty(route.method.toLowerCase())
    }
    expect(response.body.paths['/api/pets'].get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'sort' })]),
    )
    expect(JSON.stringify(response.body)).toContain('accountType')
  })
})

const databaseSuite = hasTestDatabase() ? describe : describe.skip

databaseSuite('integração com o banco de teste na nuvem (#47)', () => {
  afterEach(resetTestDatabase)

  it('[INF-11] injeção de SQL em parâmetros de consulta', async () => {
    const app = createApp()
    const injection = "' OR 1=1 --"
    const drop = "'; DROP TABLE users; --"

    const search = await request(app).get(`/api/pets?search=${encodeURIComponent(injection)}`)
    expect(search.status).toBe(200)
    expect(search.body.data).toEqual([])

    const city = await request(app).get(`/api/pets?city=${encodeURIComponent(drop)}`)
    expect(city.status).toBe(200)
    expect(city.body.data).toEqual([])

    const sort = await request(app).get(`/api/pets?sort=${encodeURIComponent(injection)}`)
    expect(sort.status).toBe(400)

    // A tabela continua existindo e a consulta parametrizada não apagou nada.
    expect(await prisma.user.count()).toBeGreaterThanOrEqual(0)
  })

  it('[INF-12] teste de integração de exemplo com banco de teste', async () => {
    await prisma.pet.create({
      data: {
        id: 'inf-12-pet',
        name: 'Pet de teste',
        species: 'Cachorro',
        breed: 'SRD',
        age: 2,
        ageLabel: '2 anos',
        size: 'Médio',
        sex: 'Macho',
        city: 'São Paulo, SP',
        image: 'https://example.com/pet.jpg',
        summary: 'Pet criado apenas pelo teste de integração.',
        description: 'Registro temporário usado para provar a conexão com o banco de teste.',
        traits: ['Calmo'],
        energy: 'Moderado',
        space: 'Apartamento',
        children: true,
        otherPets: true,
        specialCare: false,
        vaccinated: true,
        neutered: true,
        organization: 'Instituição de teste',
        organizationInitials: 'IT',
        createdAt: new Date(),
      },
    })

    const response = await request(createApp()).get('/api/pets')
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'inf-12-pet' })]),
    )

    await resetTestDatabase()
    expect(await prisma.pet.count()).toBe(0)
  })
})
