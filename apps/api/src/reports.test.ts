import type { Express } from 'express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { ensureTestOrganization } from '../test/organization.js'
import { resetTestDatabase } from '../test/reset.js'
import { startTestStorage, type TestStorage } from '../test/storage-server.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { setStorageProvider } from './storage.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)
const EXECUTABLE = Buffer.from('7f454c4602010100000000000000000002003e0001000000', 'hex')

async function makeUser(id: string, platformRole: 'USUARIO' | 'MODERADOR' = 'USUARIO') {
  const user = await prisma.user.create({
    data: {
      id,
      name: `Pessoa ${id}`,
      email: `${id}@exemplo.com`,
      platformRole,
      role: 'ADOTANTE',
    },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makeOrganization(id: string) {
  const user = await prisma.user.create({
    data: {
      id,
      name: `Organização ${id}`,
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'GUARDIAN',
      roles: ['GUARDIAN'],
    },
  })
  await prisma.guardianProfile.create({
    data: {
      userId: id,
      displayName: user.name,
      legalName: user.name,
      reviewCount: 0,
    },
  })
  return user
}

async function makePet(id: string) {
  const organization = await ensureTestOrganization('Instituição Patinhas', 'IP')
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
      specialCare: false,
      vaccinated: true,
      neutered: true,
      organizationId: organization.id,
      createdAt: new Date(),
    },
  })
}

const reportBody = (targetId: string, overrides: Record<string, unknown> = {}) => ({
  targetType: 'USUARIO',
  targetId,
  category: 'FRAUDE',
  description: 'Descrição detalhada dos fatos observados.',
  ...overrides,
})

const createReport = (
  app: Express,
  headers: Record<string, string>,
  targetId: string,
  overrides: Record<string, unknown> = {},
) => request(app).post('/api/reports').set(headers).send(reportBody(targetId, overrides))

databaseSuite('denúncias e moderação (#26)', () => {
  let app: Express
  let storage: TestStorage

  beforeAll(async () => {
    storage = await startTestStorage('adotapet-reports-test')
    process.env.STORAGE_ENDPOINT = storage.endpoint
    process.env.STORAGE_REGION = 'us-east-1'
    process.env.STORAGE_BUCKET = storage.bucket
    process.env.STORAGE_ACCESS_KEY_ID = storage.accessKeyId
    process.env.STORAGE_SECRET_ACCESS_KEY = storage.secretAccessKey
    process.env.STORAGE_FORCE_PATH_STYLE = 'true'
    process.env.STORAGE_SIGNED_URL_TTL_SECONDS = '60'
    setStorageProvider(null)
  })

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  afterAll(async () => {
    setStorageProvider(null)
    await storage?.close()
  })

  it('[DEN-01] identidade do denunciante nunca aparece ao denunciado', async () => {
    const reporter = await makeUser('den-01-reporter')
    const accused = await makeUser('den-01-accused')
    const moderator = await makeUser('den-01-moderator', 'MODERADOR')

    const created = await createReport(app, reporter.headers, accused.user.id)
    expect(created.status).toBe(201)
    const serialized = JSON.stringify(created.body)
    expect(serialized).not.toContain(reporter.user.id)
    expect(serialized).not.toContain(reporter.user.email)
    expect(serialized).not.toContain(reporter.user.name)

    const accusedView = await request(app).get('/api/me/reports').set(accused.headers)
    expect(accusedView.status).toBe(200)
    expect(accusedView.body.data).toEqual([])

    const moderation = await request(app).get('/api/moderation/reports').set(moderator.headers)
    expect(JSON.stringify(moderation.body)).not.toContain(reporter.user.email)
    expect(moderation.body.data[0]).not.toHaveProperty('reporterId')
  })

  it('[DEN-02] só MODERADOR lista e resolve denúncias', async () => {
    const reporter = await makeUser('den-02-reporter')
    const target = await makeUser('den-02-target')
    const ordinary = await makeUser('den-02-ordinary')
    const moderator = await makeUser('den-02-moderator', 'MODERADOR')
    const created = await createReport(app, reporter.headers, target.user.id)

    expect((await request(app).get('/api/moderation/reports').set(ordinary.headers)).status).toBe(
      403,
    )
    expect(
      (
        await request(app)
          .post(`/api/moderation/reports/${created.body.id}/resolve`)
          .set(ordinary.headers)
          .send({ status: 'IMPROCEDENTE', resolution: 'Não confirmada.' })
      ).status,
    ).toBe(403)
    expect((await request(app).get('/api/moderation/reports').set(moderator.headers)).status).toBe(
      200,
    )
  })

  it('[DEN-03] resolver exige resolução e registra moderador e data', async () => {
    const reporter = await makeUser('den-03-reporter')
    const target = await makeUser('den-03-target')
    const moderator = await makeUser('den-03-moderator', 'MODERADOR')
    const created = await createReport(app, reporter.headers, target.user.id)
    const path = `/api/moderation/reports/${created.body.id}/resolve`

    const invalid = await request(app)
      .post(path)
      .set(moderator.headers)
      .send({ status: 'PROCEDENTE', resolution: '' })
    expect(invalid.status).toBe(400)

    const resolved = await request(app)
      .post(path)
      .set(moderator.headers)
      .send({ status: 'PROCEDENTE', resolution: 'Fatos confirmados pela moderação.' })
    expect(resolved.status).toBe(200)
    expect(resolved.body).toMatchObject({
      status: 'PROCEDENTE',
      resolution: 'Fatos confirmados pela moderação.',
      moderatorId: moderator.user.id,
    })
    expect(resolved.body.resolvedAt).toBeTruthy()

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(stored.moderatorId).toBe(moderator.user.id)
    expect(stored.resolvedAt).toBeInstanceOf(Date)
  })

  it('[DEN-04] denúncia procedente oculta avaliação e recalcula reputação', async () => {
    const organization = await makeOrganization('den-04-org')
    const authors = await Promise.all([
      makeUser('den-04-author-a'),
      makeUser('den-04-author-b'),
      makeUser('den-04-author-c'),
    ])
    const reviews = await Promise.all(
      [5, 3, 1].map((rating, index) =>
        prisma.review.create({
          data: {
            adoptionId: `den-04-adoption-${index}`,
            reviewerId: authors[index].user.id,
            organizationId: organization.id,
            rating,
          },
        }),
      ),
    )
    await prisma.guardianProfile.update({
      where: { userId: organization.id },
      data: { reputation: 3, reviewCount: 3 },
    })
    const reporter = await makeUser('den-04-reporter')
    const moderator = await makeUser('den-04-moderator', 'MODERADOR')
    const created = await createReport(app, reporter.headers, reviews[2].id, {
      targetType: 'AVALIACAO',
      category: 'CONTEUDO_IMPROPRIO',
    })

    const response = await request(app)
      .post(`/api/moderation/reports/${created.body.id}/resolve`)
      .set(moderator.headers)
      .send({ status: 'PROCEDENTE', resolution: 'A avaliação viola as regras.' })
    expect(response.status).toBe(200)
    expect(
      (await prisma.review.findUniqueOrThrow({ where: { id: reviews[2].id } })).hiddenAt,
    ).toBeInstanceOf(Date)
    const profile = await prisma.guardianProfile.findUniqueOrThrow({
      where: { userId: organization.id },
    })
    expect(profile.reviewCount).toBe(2)
    expect(profile.reputation).toBe(4)
  })

  it('[DEN-05] sexta denúncia em 24 horas retorna 429', async () => {
    const reporter = await makeUser('den-05-reporter')
    const targets = await Promise.all(
      Array.from({ length: 6 }, (_, index) => makeUser(`den-05-target-${index}`)),
    )
    for (const target of targets.slice(0, 5)) {
      expect((await createReport(app, reporter.headers, target.user.id)).status).toBe(201)
    }
    expect((await createReport(app, reporter.headers, targets[5].user.id)).status).toBe(429)
  })

  it('[DEN-06] permite só uma denúncia aberta por denunciante e alvo', async () => {
    const reporter = await makeUser('den-06-reporter')
    const target = await makeUser('den-06-target')
    expect((await createReport(app, reporter.headers, target.user.id)).status).toBe(201)
    expect((await createReport(app, reporter.headers, target.user.id)).status).toBe(409)
    expect(await prisma.report.count({ where: { reporterId: reporter.user.id } })).toBe(1)
  })

  it('[DEN-07] maus-tratos e abandono orientam sobre canais oficiais', async () => {
    const reporter = await makeUser('den-07-reporter')
    const first = await makeUser('den-07-target-a')
    const second = await makeUser('den-07-target-b')
    for (const [targetId, category] of [
      [first.user.id, 'MAUS_TRATOS'],
      [second.user.id, 'ABANDONO'],
    ] as const) {
      const response = await createReport(app, reporter.headers, targetId, { category })
      expect(response.status).toBe(201)
      expect(response.body.officialGuidance).toMatch(/delegacia/i)
      expect(response.body.officialGuidance).toMatch(/Disque-Denúncia/i)
      expect(response.body.officialGuidance).toMatch(/órgão ambiental/i)
    }
  })

  it('[DEN-08] anexos seguem as regras seguras de upload', async () => {
    const reporter = await makeUser('den-08-reporter')
    const pet = await makePet('den-08-pet')
    const base = () =>
      request(app)
        .post('/api/reports')
        .set(reporter.headers)
        .field('targetType', 'PET')
        .field('targetId', pet.id)
        .field('category', 'MAUS_TRATOS')
        .field('description', 'Descrição detalhada dos fatos observados.')

    const invalid = await base().attach('files', EXECUTABLE, 'foto.png')
    expect(invalid.status).toBe(400)

    let tooMany = base()
    for (let index = 0; index < 6; index += 1) {
      tooMany = tooMany.attach('files', PNG, `foto-${index}.png`)
    }
    expect((await tooMany).status).toBe(400)

    const valid = await base().attach('files', PNG, '../../../segredo.png')
    expect(valid.status).toBe(201)
    expect(valid.body.attachments).toHaveLength(1)
    const object = await prisma.storageObject.findFirstOrThrow({
      where: { resourceType: 'REPORT', resourceId: valid.body.id },
    })
    expect(object.ownerId).toBe(reporter.user.id)
    expect(object.key).toMatch(/^reports\/[0-9a-f-]{36}\.png$/)
    expect(object.key).not.toContain('segredo')
  })

  it('[DEN-09] GET /me/reports traz somente as próprias denúncias', async () => {
    const alice = await makeUser('den-09-alice')
    const bob = await makeUser('den-09-bob')
    const targetA = await makeUser('den-09-target-a')
    const targetB = await makeUser('den-09-target-b')
    await createReport(app, alice.headers, targetA.user.id)
    await createReport(app, bob.headers, targetB.user.id)

    const aliceList = await request(app).get('/api/me/reports').set(alice.headers)
    const bobList = await request(app).get('/api/me/reports').set(bob.headers)
    expect(aliceList.status).toBe(200)
    expect(bobList.status).toBe(200)
    expect(aliceList.body.data.map((item: { targetId: string }) => item.targetId)).toEqual([
      targetA.user.id,
    ])
    expect(bobList.body.data.map((item: { targetId: string }) => item.targetId)).toEqual([
      targetB.user.id,
    ])
  })
})
