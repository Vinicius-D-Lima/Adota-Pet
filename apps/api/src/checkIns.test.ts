import type { Express } from 'express'
import { TestClock } from 'pg-boss'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { startTestStorage, type TestStorage } from '../test/storage-server.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { processCheckInDeadlines } from './checkIns.js'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import { QUEUES, clearJobHandlers, createJobRunner, registerJobHandler } from './jobs.js'
import { signObjectUrl, setStorageProvider } from './storage.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const connectionString = process.env.DATABASE_URL ?? ''
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)
const GIF = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00')
const EXECUTABLE = Buffer.from('7f454c4602010100000000000000000002003e0001000000', 'hex')

let storage: TestStorage

async function makeUser(id: string) {
  const user = await prisma.user.create({
    data: { id, name: id, email: `${id}@exemplo.com` },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makeCheckIn(id: string, dueDate = new Date(Date.now() + 86_400_000)) {
  const organization = await prisma.organization.create({
    data: { name: `Instituto ${id}`, initials: 'IT' },
  })
  const adopter = await makeUser(`${id}-adopter`)
  const member = await makeUser(`${id}-member`)
  const outsider = await makeUser(`${id}-outsider`)
  await prisma.membership.create({
    data: { userId: member.user.id, organizationId: organization.id },
  })
  const pet = await prisma.pet.create({
    data: {
      id: `${id}-pet`,
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
  const adoptionRequest = await prisma.adoptionRequest.create({
    data: {
      id: `${id}-request`,
      userId: adopter.user.id,
      petId: pet.id,
      status: 'APROVADA',
      date: new Date(),
      message: 'Adoção aprovada',
    },
  })
  const adoption = await prisma.adoption.create({
    data: {
      requestId: adoptionRequest.id,
      petId: pet.id,
      adopterId: adopter.user.id,
      organizationId: organization.id,
    },
  })
  const checkIn = await prisma.checkIn.create({ data: { adoptionId: adoption.id, dueDate } })
  return { adoption, adopter, member, outsider, checkIn }
}

function submit(
  app: Express,
  id: string,
  headers: Record<string, string>,
  files: Array<[Buffer, string]> = [[PNG, 'foto.png']],
  report = 'Tudo está indo bem na adaptação.',
) {
  let call = request(app).post(`/api/check-ins/${id}/submit`).set(headers).field('report', report)
  for (const [body, filename] of files) call = call.attach('files', body, filename)
  return call
}

databaseSuite('check-ins pós-adoção (#24)', () => {
  let app: Express

  beforeAll(async () => {
    storage = await startTestStorage('adotapet-checkins-test')
    process.env.STORAGE_ENDPOINT = storage.endpoint
    process.env.STORAGE_REGION = 'us-east-1'
    process.env.STORAGE_BUCKET = storage.bucket
    process.env.STORAGE_ACCESS_KEY_ID = storage.accessKeyId
    process.env.STORAGE_SECRET_ACCESS_KEY = storage.secretAccessKey
    process.env.STORAGE_FORCE_PATH_STYLE = 'true'
    process.env.STORAGE_SIGNED_URL_TTL_SECONDS = '60'
    setStorageProvider(null)
  })

  afterAll(async () => {
    setStorageProvider(null)
    await storage?.close()
  })

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    clearJobHandlers()
    await resetTestDatabase()
  })

  it('[CHK-01] aceita apenas JPEG, PNG e WebP', async () => {
    const { adopter, checkIn } = await makeCheckIn('chk-01')
    const response = await submit(app, checkIn.id, adopter.headers, [[GIF, 'foto.gif']])
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Upload inválido')
  })

  it('[CHK-02] valida o tipo real do arquivo, não sua extensão', async () => {
    const { adopter, checkIn } = await makeCheckIn('chk-02')
    const response = await submit(app, checkIn.id, adopter.headers, [
      [EXECUTABLE, 'executavel.jpg'],
    ])
    expect(response.status).toBe(400)
  })

  it('[CHK-03] limita cada foto a 5 MB e cada envio a 5 fotos', async () => {
    const { adopter, checkIn } = await makeCheckIn('chk-03')
    const oversized = await submit(app, checkIn.id, adopter.headers, [
      [Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), 'grande.png'],
    ])
    expect(oversized.status).toBe(400)

    const tooMany = await submit(
      app,
      checkIn.id,
      adopter.headers,
      Array.from({ length: 6 }, () => [PNG, 'foto.png'] as [Buffer, string]),
    )
    expect(tooMany.status).toBe(400)
  })

  it('[CHK-04] só o adotante envia e só membros da organização revisam', async () => {
    const { adopter, member, outsider, checkIn } = await makeCheckIn('chk-04')
    expect((await submit(app, checkIn.id, outsider.headers)).status).toBe(403)

    const submitted = await submit(app, checkIn.id, adopter.headers)
    expect(submitted.status).toBe(200)
    expect(
      (
        await request(app)
          .post(`/api/check-ins/${checkIn.id}/review`)
          .set(adopter.headers)
          .send({ reviewerComment: 'Tudo certo.' })
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .post(`/api/check-ins/${checkIn.id}/review`)
          .set(outsider.headers)
          .send({ reviewerComment: 'Tudo certo.' })
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .post(`/api/check-ins/${checkIn.id}/submit`)
          .set(member.headers)
          .field('report', 'Relato inválido')
          .attach('files', PNG, 'foto.png')
      ).status,
    ).toBe(403)
  })

  it('[CHK-05] apenas as partes conseguem solicitar URL de foto', async () => {
    const { adopter, member, outsider, checkIn } = await makeCheckIn('chk-05')
    const submitted = await submit(app, checkIn.id, adopter.headers)
    const photoId = submitted.body.photos[0] as string

    const denied = await request(app)
      .post(`/api/check-ins/${checkIn.id}/photos/${photoId}/url`)
      .set(outsider.headers)
    expect(denied.status).toBe(403)

    const allowed = await request(app)
      .post(`/api/check-ins/${checkIn.id}/photos/${photoId}/url`)
      .set(member.headers)
    expect(allowed.status).toBe(200)
    expect((await request(app).get(allowed.body.url)).status).toBe(200)
    expect((await request(app).get(`/files/${photoId}`)).status).toBe(403)
  })

  it('[CHK-06] gera o nome do objeto no servidor', async () => {
    const { adopter, checkIn } = await makeCheckIn('chk-06')
    const submitted = await submit(app, checkIn.id, adopter.headers, [[PNG, '../../passwd.png']])
    expect(submitted.status).toBe(200)

    const object = await prisma.storageObject.findUniqueOrThrow({
      where: { id: submitted.body.photos[0] as string },
    })
    expect(object.key).toMatch(/^check-ins\/[0-9a-f-]{36}\.png$/)
    expect(object.key).not.toContain('..')
    expect(object.key).not.toContain('passwd')
  })

  it('[CHK-07] o job pg-boss marca check-ins vencidos como ATRASADO', async () => {
    const base = new Date(Date.now() + 86_400_000)
    base.setUTCHours(7, 59, 50, 0)
    const dueDate = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()) - 86_400_000,
    )
    const { checkIn } = await makeCheckIn('chk-07', dueDate)
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "pgboss_checkin_test" CASCADE')
    const clock = new TestClock(base)
    const runner = createJobRunner({
      connectionString,
      schema: 'pgboss_checkin_test',
      clock,
      spies: true,
      pollingIntervalSeconds: 0.5,
      shutdownTimeoutMs: 5_000,
    })
    registerJobHandler(QUEUES.checkInOverdue, () =>
      processCheckInDeadlines(new Date(base.getTime() + 15_000)),
    )

    await runner.start()
    try {
      await clock.setTime(base.getTime() + 15_000)
      await clock.tick(31_000)
      await runner.boss.getSpy(QUEUES.checkInOverdue).waitForJob(() => true, 'completed')
      await vi.waitFor(async () => {
        expect((await prisma.checkIn.findUniqueOrThrow({ where: { id: checkIn.id } })).status).toBe(
          'ATRASADO',
        )
      })
    } finally {
      await runner.stop()
      await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "pgboss_checkin_test" CASCADE')
    }
  })

  it('[CHK-08] respeita as transições enviar, pedir informações e revisar', async () => {
    const { adopter, member, checkIn } = await makeCheckIn('chk-08')
    const first = await submit(app, checkIn.id, adopter.headers)
    expect(first.body.status).toBe('ENVIADO')

    const requested = await request(app)
      .post(`/api/check-ins/${checkIn.id}/request-more`)
      .set(member.headers)
      .send({ reviewerComment: 'Envie uma atualização sobre a alimentação.' })
    expect(requested.status).toBe(200)
    expect(requested.body.status).toBe('PENDENTE')

    const second = await submit(app, checkIn.id, adopter.headers, [[PNG, 'nova-foto.png']])
    expect(second.body.status).toBe('ENVIADO')

    const reviewed = await request(app)
      .post(`/api/check-ins/${checkIn.id}/review`)
      .set(member.headers)
      .send({ reviewerComment: 'Acompanhamento concluído.' })
    expect(reviewed.status).toBe(200)
    expect(reviewed.body.status).toBe('REVISADO')
    expect(
      (
        await request(app)
          .post(`/api/check-ins/${checkIn.id}/review`)
          .set(member.headers)
          .send({ reviewerComment: 'Revisão repetida.' })
      ).status,
    ).toBe(409)
  })

  it('[CHK-09] grava eventos de vencimento, atraso e revisão', async () => {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const dueDate = today
    const overdueDate = new Date(today.getTime() - 86_400_000)
    const due = await makeCheckIn('chk-09-due', dueDate)
    const overdue = await makeCheckIn('chk-09-overdue', overdueDate)

    await processCheckInDeadlines(now)
    const { adopter, member, checkIn } = await makeCheckIn('chk-09-review')
    await submit(app, checkIn.id, adopter.headers)
    await request(app)
      .post(`/api/check-ins/${checkIn.id}/review`)
      .set(member.headers)
      .send({ reviewerComment: 'Revisado.' })

    const events = await prisma.eventOutbox.findMany({ select: { type: true } })
    expect(events.map(({ type }) => type).sort()).toEqual(
      ['CheckInDue', 'CheckInOverdue', 'CheckInReviewed'].sort(),
    )
    expect((await prisma.checkIn.findUniqueOrThrow({ where: { id: due.checkIn.id } })).status).toBe(
      'PENDENTE',
    )
    expect(
      (await prisma.checkIn.findUniqueOrThrow({ where: { id: overdue.checkIn.id } })).status,
    ).toBe('ATRASADO')
  })

  it('[CHK-10] URL assinada expirada retorna 403', async () => {
    const { adopter, checkIn } = await makeCheckIn('chk-10')
    const submitted = await submit(app, checkIn.id, adopter.headers)
    const photoId = submitted.body.photos[0] as string
    const config = loadConfig()
    const expired = await signObjectUrl(
      photoId,
      -10,
      config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
    )

    expect((await request(app).get(expired.url)).status).toBe(403)
  })
})
