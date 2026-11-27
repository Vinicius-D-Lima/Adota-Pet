import type { Express } from 'express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
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
import { ensureTestOrganization } from '../test/organization.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { prisma } from './db.js'
import { type StorageProvider, setStorageProvider } from './storage.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip

const SQL_TAUTOLOGY = "' OR '1'='1"
const SQL_UNION = "' UNION SELECT id, email FROM users --"
const SQL_DROP = '\'; DROP TABLE "Pet"; --'
const SCRIPT = '<script>alert("xss")</script>'
const IMG = '<img src=x onerror=alert(1)>'
const JS_URL = 'javascript:alert(1)'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

// As factories compartilhadas exportam makeUser com opções; estes wrappers
// reproduzem makeAdopter/makeGuardian sem duplicar a criação das tabelas.
const makeAdopter = (id: string) => makeUser(id)
async function makeGuardian(id: string, organizationName = ORGANIZATION) {
  const fixture = await makeUser(id, { guardian: true, organizationName })
  await addMembership(fixture.user.id, organizationName)
  return fixture
}

// makePet da factory não informa `createdAt`, obrigatório no schema atual; o
// helper local mantém o mesmo formato de registro usado pelos testes de pets.
async function petFixture(id: string, options: { name?: string } = {}) {
  const organization = await ensureTestOrganization(ORGANIZATION, 'IP')
  return prisma.pet.create({
    data: {
      id,
      name: options.name ?? `Pet ${id}`,
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
      organizationId: organization.id,
      status: 'DISPONIVEL',
      createdAt: new Date(),
    },
  })
}

function petBody(name: string) {
  return {
    name,
    species: 'Cachorro',
    breed: 'SRD',
    age: 2,
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
    otherPets: false,
  }
}

const fieldDetails = (fields: string[]) =>
  expect.arrayContaining(fields.map((field) => expect.objectContaining({ field })))

databaseSuite('segurança: injeção, XSS e validação de parâmetros (#129/#130/#134)', () => {
  let app: Express
  let uploaded: Array<{ key: string; body: Buffer; contentType: string }> = []
  let previousEnv: Record<string, string | undefined> = {}

  /** Armazenamento em memória: o teste não depende de S3 nem de servidor externo. */
  const memoryProvider: StorageProvider = {
    bucket: 'security-test',
    async ensureBucket() {},
    async putObject({ key, body, contentType }) {
      uploaded.push({ key, body, contentType })
      return { key, contentType, sizeBytes: body.byteLength }
    },
    async getObject(key) {
      const file = uploaded.find((item) => item.key === key)
      if (!file) throw new Error('objeto ausente')
      return { body: file.body, contentType: file.contentType, sizeBytes: file.body.byteLength }
    },
    async deleteObject(key) {
      uploaded = uploaded.filter((item) => item.key !== key)
    },
    async objectExists(key) {
      return uploaded.some((item) => item.key === key)
    },
    async presignGet() {
      return 'http://storage.test/objeto'
    },
  }

  beforeAll(() => {
    previousEnv = {
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
      STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
      STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
    }
    process.env.STORAGE_ENDPOINT = 'http://storage.test'
    process.env.STORAGE_ACCESS_KEY_ID = 'teste'
    process.env.STORAGE_SECRET_ACCESS_KEY = 'teste'
    setStorageProvider(memoryProvider)
  })

  afterAll(() => {
    setStorageProvider(null)
    uploaded = []
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[SQLI-01] payloads de UNION/tautologia em search e city continuam texto', async () => {
    const pet = await petFixture('sqli-01-pet', { name: "O'Brian" })
    await petFixture('sqli-01-other')

    // Diferença de INF-11/PET-09: aqui existe aspas simples legítima no banco,
    // então a busca prova que o termo é comparado como substring, não como SQL.
    const literal = await request(app).get('/api/pets').query({ search: "O'Brian" })
    expect(literal.status).toBe(200)
    expect(literal.body.data).toEqual([expect.objectContaining({ id: 'sqli-01-pet' })])

    const union = await request(app).get('/api/pets').query({ search: SQL_UNION })
    expect(union.status).toBe(200)
    expect(union.body.total).toBe(0)

    const city = await request(app).get('/api/pets').query({ city: SQL_TAUTOLOGY })
    expect(city.status).toBe(200)
    expect(city.body.total).toBe(0)

    const sort = await request(app).get('/api/pets').query({ sort: SQL_DROP })
    expect(sort.status).toBe(400)
    expect(sort.body.details).toEqual(fieldDetails(['sort']))

    expect(await prisma.pet.findUnique({ where: { id: pet.id } })).not.toBeNull()
    expect(await prisma.pet.findUnique({ where: { id: 'sqli-01-other' } })).not.toBeNull()
    expect(
      await prisma.organization.findUnique({ where: { id: pet.organizationId } }),
    ).not.toBeNull()
  })

  it('[SQLI-02] page/limit injetados e encoding duplo não geram 5xx', async () => {
    await petFixture('sqli-02-pet')

    for (const payload of ['-1', '0', '1.5', 'abc', '1e999', SQL_DROP]) {
      for (const field of ['page', 'limit'] as const) {
        const response = await request(app)
          .get('/api/pets')
          .query({ [field]: payload })
        expect(response.status).toBe(400)
        expect(response.body.details).toEqual(fieldDetails([field]))
      }
    }

    // Comportamento real: só `limit` tem teto (100); `page` aceita inteiro positivo qualquer.
    const overLimit = await request(app).get('/api/pets').query({ limit: '101' })
    expect(overLimit.status).toBe(400)
    expect(overLimit.body.details).toEqual(fieldDetails(['limit']))
    expect((await request(app).get('/api/pets').query({ page: '101' })).status).toBe(200)

    // Codificado duas vezes: o servidor decodifica uma camada e trata o restante
    // como texto comum de busca (não há segunda interpretação de SQL).
    const doubleEncoded = await request(app)
      .get('/api/pets')
      .query({ search: encodeURIComponent(SQL_UNION) })
    expect(doubleEncoded.status).toBe(200)
    expect(doubleEncoded.body.total).toBe(0)
    expect(await prisma.pet.findUnique({ where: { id: 'sqli-02-pet' } })).not.toBeNull()
  })

  it('[SQLI-03] path params com SQL não alcançam outro registro', async () => {
    await petFixture('sqli-03-pet')
    const guardian = await makeGuardian('sqli-03-guardian')

    for (const payload of [SQL_TAUTOLOGY, SQL_UNION, SQL_DROP]) {
      const detail = await request(app).get(`/api/pets/${encodeURIComponent(payload)}`)
      expect(detail.status).toBe(404)

      const archive = await request(app)
        .post(`/api/pets/${encodeURIComponent(payload)}/archive`)
        .set(guardian.headers)
      expect(archive.status).toBe(404)
    }

    const edited = await request(app)
      .put(`/api/pets/${encodeURIComponent(`sqli-03-pet${SQL_TAUTOLOGY}`)}`)
      .set(guardian.headers)
      .send({ name: 'Pet sequestrado' })
    expect(edited.status).toBe(404)

    expect(await prisma.pet.findUniqueOrThrow({ where: { id: 'sqli-03-pet' } })).toMatchObject({
      name: 'Pet sqli-03-pet',
      status: 'DISPONIVEL',
    })
  })

  it('[SQLI-04] texto injetado no corpo é gravado como dado, não executado', async () => {
    const guardian = await makeGuardian('sqli-04-guardian')
    const adopter = await makeAdopter('sqli-04-adopter')
    const organization = await ensureTestOrganization(ORGANIZATION, 'IP')

    const injected = {
      name: `Pet ${SQL_TAUTOLOGY}`,
      summary: SQL_UNION,
      description: SQL_DROP,
      traits: [SQL_TAUTOLOGY],
      organizationId: SQL_TAUTOLOGY,
      status: 'ADOTADO',
    }
    const created = await request(app)
      .post('/api/pets')
      .set(guardian.headers)
      .send({ ...petBody('Pet ignorado'), ...injected })
    expect(created.status).toBe(201)
    expect(JSON.stringify(created.body)).toContain(SQL_TAUTOLOGY)

    expect(
      await prisma.pet.findUniqueOrThrow({ where: { id: created.body.id as string } }),
    ).toMatchObject({
      name: injected.name,
      summary: injected.summary,
      description: injected.description,
      traits: injected.traits,
      organizationId: organization.id,
      status: 'DISPONIVEL',
    })

    const missingPet = await request(app)
      .post('/api/requests')
      .set(adopter.headers)
      .send({ petId: SQL_UNION, answers: QUESTIONNAIRE })
    expect(missingPet.status).toBe(404)
    expect(await prisma.adoptionRequest.count()).toBe(0)
  })

  it('[SQLI-05] cabeçalhos injetados não autenticam nem trocam a identidade', async () => {
    const first = await makeAdopter('sqli-05-primeiro')
    const second = await makeAdopter('sqli-05-segundo')
    const pet = await petFixture('sqli-05-pet')
    await makeRequest('sqli-05-pedido', first.user.id, pet.id)
    await makeRequest('sqli-05-outro', second.user.id, pet.id)

    const invalidBearer = await request(app).get('/api/me/requests').set(bearer(SQL_UNION))
    expect(invalidBearer.status).toBe(401)

    const cookie = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${encodeURIComponent(SQL_TAUTOLOGY)}`)
    expect(cookie.status).toBe(401)

    // Com JWT válido, req.user prevalece sobre o cabeçalho demo legado.
    const spoofed = await request(app)
      .get('/api/me/requests')
      .set(first.headers)
      .set('X-Demo-User-Id', second.user.id)
    expect(spoofed.status).toBe(200)
    expect(spoofed.body.data).toEqual([
      expect.objectContaining({ id: 'sqli-05-pedido', userId: first.user.id }),
    ])
    for (const id of [first.user.id, second.user.id]) {
      expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull()
    }
  })

  it('[XSS-01] nome e descrição do pet voltam como texto em JSON', async () => {
    const guardian = await makeGuardian('xss-01-guardian')
    const created = await request(app)
      .post('/api/pets')
      .set(guardian.headers)
      .send({ ...petBody('Pet original'), name: SCRIPT, description: IMG })
    expect(created.status).toBe(201)
    expect(created.headers['content-type']).toMatch(/application\/json/)
    expect(created.headers['x-content-type-options']).toBe('nosniff')
    expect(created.body.name).toBe(SCRIPT)
    expect(created.body.description).toBe(IMG)

    // A API não injeta HTML: devolve JSON com nosniff. O escape final é do cliente.
    expect(
      await prisma.pet.findUniqueOrThrow({ where: { id: created.body.id as string } }),
    ).toMatchObject({ name: SCRIPT, description: IMG })

    const detail = await request(app).get(`/api/pets/${created.body.id as string}`)
    expect(detail.status).toBe(200)
    expect(detail.headers['content-type']).toMatch(/application\/json/)
    expect(detail.body.name).toBe(SCRIPT)
    expect(detail.body.description).toBe(IMG)
  })

  it('[XSS-02] organização e notificação preservam payloads como texto', async () => {
    const guardian = await makeGuardian('xss-02-guardian')
    const adopter = await makeAdopter('xss-02-adopter')
    const organization = await ensureTestOrganization(ORGANIZATION, 'IP')

    const updated = await request(app)
      .put(`/api/organizations/${organization.id}`)
      .set(guardian.headers)
      .send({ name: SCRIPT, description: IMG })
    expect(updated.status).toBe(200)
    expect(updated.body.name).toBe(SCRIPT)
    expect(updated.body.description).toBe(IMG)
    expect(
      await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } }),
    ).toMatchObject({ name: SCRIPT, description: IMG })

    await prisma.notification.create({
      data: {
        id: 'xss-02-notificacao',
        userId: adopter.user.id,
        type: 'NOVA_MENSAGEM',
        title: IMG,
        body: SCRIPT,
        link: JS_URL,
        createdAt: new Date(),
      },
    })
    const notifications = await request(app).get('/api/me/notifications').set(adopter.headers)
    expect(notifications.status).toBe(200)
    expect(notifications.headers['content-type']).toMatch(/application\/json/)
    expect(notifications.body.data[0]).toMatchObject({
      title: IMG,
      body: SCRIPT,
      link: JS_URL,
      readAt: null,
    })
  })

  it('[XSS-03] perfil e avaliação devolvem o payload literal', async () => {
    const profileUser = await makeAdopter('xss-03-perfil')
    const profile = await request(app)
      .put('/api/me/adopter-profile')
      .set(profileUser.headers)
      .send({ ...PROFILE, name: SCRIPT, address: IMG })
    expect(profile.status).toBe(200)
    expect(profile.body.name).toBe(SCRIPT)
    expect(profile.body.address).toBe(IMG)

    // makeAdoption usa a factory de pet incompleta; montei a adoção com as
    // mesmas tabelas para chegar à rota de avaliação sem alterar a factory.
    const adopter = await makeAdopter('xss-03-adopter')
    const organization = await ensureTestOrganization(ORGANIZATION, 'IP')
    const pet = await petFixture('xss-03-pet')
    const adoptionRequest = await makeRequest('xss-03-request', adopter.user.id, pet.id)
    const adoption = await prisma.adoption.create({
      data: {
        requestId: adoptionRequest.id,
        petId: pet.id,
        adopterId: adopter.user.id,
        organizationId: organization.id,
        adoptedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    })
    const review = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(adopter.headers)
      .send({ rating: 5, comment: IMG })
    expect(review.status).toBe(201)
    expect(review.body.comment).toBe(IMG)
    expect(
      await prisma.review.findUniqueOrThrow({ where: { id: review.body.id as string } }),
    ).toMatchObject({
      comment: IMG,
    })
  })

  it('[XSS-04] chat, nome de arquivo e erros não refletem HTML ativo', async () => {
    const adopter = await makeAdopter('xss-04-adopter')
    const pet = await petFixture('xss-04-pet')
    const adoptionRequest = await makeRequest('xss-04-request', adopter.user.id, pet.id)

    const sent = await request(app)
      .post(`/api/requests/${adoptionRequest.id}/messages`)
      .set(adopter.headers)
      .send({ body: SCRIPT })
    expect(sent.status).toBe(201)
    expect(sent.body.body).toBe(SCRIPT)
    const messages = await request(app)
      .get(`/api/requests/${adoptionRequest.id}/messages`)
      .set(adopter.headers)
    expect(messages.body.data[0].body).toBe(SCRIPT)

    const upload = await request(app)
      .post('/api/storage/objects')
      .set(adopter.headers as Headers)
      .field('scope', 'petPhoto')
      .field('resourceType', 'PET')
      .field('resourceId', pet.id)
      .attach('files', PNG, `${IMG}.png`)
    expect(upload.status).toBe(201)
    expect(upload.body.data).toHaveLength(1)
    // A chave é gerada no servidor: prefixo sanitizado + UUID + extensão do MIME.
    expect(upload.body.data[0].key).toMatch(/^pets\/[0-9a-f-]+\.png$/)
    expect(upload.body.data[0].key).not.toContain('<')
    expect(
      await prisma.storageObject.findUniqueOrThrow({ where: { id: upload.body.data[0].id } }),
    ).toMatchObject({ key: upload.body.data[0].key })

    // REQ-09 já cobre as respostas do questionário; aqui só verificamos que os
    // erros com payload na URL/corpo permanecem no formato JSON genérico.
    const missingPet = await request(app).get(`/api/pets/${encodeURIComponent(SCRIPT)}`)
    expect(missingPet.status).toBe(404)
    expect(missingPet.headers['content-type']).toMatch(/application\/json/)
    expect(missingPet.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Pet não encontrado',
    })
    expect(JSON.stringify(missingPet.body)).not.toContain('<script')

    const badPetId = await request(app)
      .post('/api/requests')
      .set(adopter.headers)
      .send({ petId: IMG, answers: QUESTIONNAIRE })
    expect(badPetId.status).toBe(404)
    expect(JSON.stringify(badPetId.body)).not.toContain('<img')
  })

  it('[PARAM-01] page/limit negativos, zero, decimais, texto, teto e duplicados', async () => {
    await petFixture('param-01-pet')

    for (const payload of ['-1', '0', '1.5', 'abc', 'NaN', SQL_TAUTOLOGY]) {
      for (const field of ['page', 'limit'] as const) {
        const response = await request(app)
          .get('/api/pets')
          .query({ [field]: payload })
        expect(response.status).toBe(400)
        expect(response.body.details).toEqual(fieldDetails([field]))
      }
    }

    const overLimit = await request(app).get('/api/pets').query({ limit: '101' })
    expect(overLimit.status).toBe(400)
    expect(overLimit.body.details).toEqual(fieldDetails(['limit']))
    // `page` não tem teto no contrato atual: 101 é aceito como página válida.

    const duplicates = await request(app)
      .get('/api/pets')
      .query({ page: ['1', '2'], limit: ['2', '3'] })
    expect(duplicates.status).toBe(400)
    expect(duplicates.body.details).toEqual(fieldDetails(['page', 'limit']))

    const unknown = await request(app).get('/api/pets').query({ desconhecido: '1' })
    expect(unknown.status).toBe(400)
    expect(unknown.body.details).toEqual(fieldDetails(['desconhecido']))
    expect(await prisma.pet.findUnique({ where: { id: 'param-01-pet' } })).not.toBeNull()
  })

  it('[PARAM-02] sort inválido e coordenadas fora do intervalo', async () => {
    const invalidSort = await request(app)
      .get('/api/pets')
      .query({ sort: 'name; DROP TABLE pets;--' })
    expect(invalidSort.status).toBe(400)
    expect(invalidSort.body.details).toEqual(fieldDetails(['sort']))

    const coordinates: Array<[string, string, string]> = [
      ['91', '0', 'lat'],
      ['-91', '0', 'lat'],
      ['0', '181', 'lng'],
      ['0', '-181', 'lng'],
      ['abc', '0', 'lat'],
    ]
    for (const [lat, lng, field] of coordinates) {
      const response = await request(app).get('/api/pets').query({ sort: 'distance', lat, lng })
      expect(response.status).toBe(400)
      expect(response.body.details).toEqual(fieldDetails([field]))
    }

    const missing = await request(app).get('/api/pets').query({ sort: 'distance' })
    expect(missing.status).toBe(400)
    expect(missing.body.details).toEqual(fieldDetails(['lat', 'lng']))

    // Comportamento real: lat/lng só são validados quando sort=distance; fora
    // disso o contrato aceita texto e o handler ignora esses parâmetros.
    const ignored = await request(app).get('/api/pets').query({ lat: '91', lng: '181' })
    expect(ignored.status).toBe(200)
    expect((await request(app).get('/api/pets').query({ sort: 'name' })).status).toBe(200)
  })

  it('[PARAM-03] filtros enum inválidos não quebram a consulta', async () => {
    await petFixture('param-03-pet')

    // Pet.species/size/sex são colunas String: um valor fora do enum vira filtro
    // literal e a listagem devolve 200 vazia (não 400). O 400 com details está
    // na escrita, onde o Zod valida o enum do contrato.
    for (const filter of [
      { species: `Cachorro${SQL_TAUTOLOGY}` },
      { size: 'Enorme' },
      { sex: 'Outro' },
    ]) {
      const response = await request(app).get('/api/pets').query(filter)
      expect(response.status).toBe(200)
      expect(response.body.total).toBe(0)
    }

    const guardian = await makeGuardian('param-03-guardian')
    const invalidWrite = await request(app)
      .post('/api/pets')
      .set(guardian.headers)
      .send({ ...petBody('Pet inválido'), species: 'Pássaro', size: 'Enorme', sex: 'Outro' })
    expect(invalidWrite.status).toBe(400)
    expect(invalidWrite.body.details).toEqual(fieldDetails(['species', 'size', 'sex']))
    expect(await prisma.pet.findUnique({ where: { id: 'param-03-pet' } })).not.toBeNull()
  })

  it('[PARAM-04] parâmetros duplicados/desconhecidos e prototype pollution', async () => {
    const pollutedQuery = await request(app)
      .get('/api/pets')
      .query('__proto__=x&constructor=y&desconhecido=1')
    expect(pollutedQuery.status).toBe(400)
    expect(pollutedQuery.body.details).toEqual(
      fieldDetails(['__proto__', 'constructor', 'desconhecido']),
    )

    // Repetir `size` é legítimo (o frontend envia uma lista de portes).
    const repeatedSize = await request(app)
      .get('/api/pets')
      .query({ size: ['Pequeno', 'Médio'] })
    expect(repeatedSize.status).toBe(200)

    const guardian = await makeGuardian('param-04-guardian')
    const pollutedBody = Object.assign(
      petBody('Pet 04'),
      JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}'),
    )
    const created = await request(app)
      .post('/api/pets')
      .set(guardian.headers)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(pollutedBody))
    expect(created.status).toBe(201)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    expect(
      await prisma.pet.findUniqueOrThrow({ where: { id: created.body.id as string } }),
    ).toMatchObject({
      name: 'Pet 04',
    })
  })

  it('[PARAM-05] BOLA e campos controlados pelo servidor no corpo', async () => {
    const adopter = await makeAdopter('param-05-adopter')
    const outsider = await makeAdopter('param-05-outsider')
    const firstPet = await petFixture('param-05-pet-a')
    const secondPet = await petFixture('param-05-pet-b')
    const adoptionRequest = await makeRequest('param-05-request', adopter.user.id, firstPet.id)

    const read = await request(app).get(`/api/requests/${adoptionRequest.id}`).set(outsider.headers)
    expect(read.status).toBe(403)

    const transition = await request(app)
      .post(`/api/requests/${adoptionRequest.id}/transitions`)
      .set(outsider.headers)
      .send({ to: 'CANCELADA' })
    expect(transition.status).toBe(403)

    const forged = await request(app)
      .post(`/api/requests/${adoptionRequest.id}/transitions`)
      .set(adopter.headers)
      .send({
        to: 'CANCELADA',
        status: 'APROVADA',
        adopterId: outsider.user.id,
        organizationId: 'param-05-org',
        version: 99,
      })
    expect(forged.status).toBe(400)
    // Validador strict reporta chaves extras como um único erro no corpo.
    expect(forged.body.details).toEqual([
      expect.objectContaining({
        field: 'body',
        message: expect.stringContaining('Unrecognized keys'),
      }),
    ])
    expect(
      await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: adoptionRequest.id } }),
    ).toMatchObject({ status: 'ANALISE_QUESTIONARIO', version: 1, userId: adopter.user.id })

    const created = await request(app).post('/api/requests').set(adopter.headers).send({
      petId: secondPet.id,
      answers: QUESTIONNAIRE,
      userId: outsider.user.id,
      adopterId: outsider.user.id,
      status: 'APROVADA',
      organizationId: 'param-05-org',
      version: 99,
    })
    expect(created.status).toBe(201)
    expect(
      await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: created.body.id as string } }),
    ).toMatchObject({ userId: adopter.user.id, status: 'ENVIADA', version: 1 })
  })
})
