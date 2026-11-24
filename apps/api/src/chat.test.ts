import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { ensureTestOrganization } from '../test/organization.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const ORGANIZATION = 'Instituição Patinhas'

async function makeUser(id: string, name: string, extra: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      id,
      name,
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
      ...extra,
    },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makeGuardian(id: string) {
  const auth = await makeUser(id, ORGANIZATION, {
    platformRole: 'MODERADOR',
    role: 'GUARDIAN',
    roles: ['GUARDIAN'],
    organizationName: ORGANIZATION,
    phone: '(11) 3333-4444',
    guardianProfile: {
      create: {
        guardianType: 'ORGANIZATION',
        displayName: ORGANIZATION,
        legalName: ORGANIZATION,
        document: '12.345.678/0001-90',
        email: `${id}@exemplo.com`,
        phone: '(11) 3333-4444',
        zipCode: '01310-100',
        address: 'Avenida Paulista, 1000',
        city: 'São Paulo',
        description: 'Organização de proteção animal',
        acceptsTerms: true,
      },
    },
  })
  const organization = await ensureTestOrganization(ORGANIZATION, 'IP')
  await prisma.membership.create({
    data: { userId: id, organizationId: organization.id, role: 'ADMIN', status: 'ATIVO' },
  })
  return auth
}

async function makePet(id: string) {
  const organization = await ensureTestOrganization(ORGANIZATION, 'IP')
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
      organizationId: organization.id,
      createdAt: new Date(),
      status: 'DISPONIVEL',
    },
  })
}

async function makeRequest(id: string, userId: string, petId: string, status = 'Em análise') {
  return prisma.adoptionRequest.create({
    data: { id, userId, petId, status, date: new Date(), message: 'Solicitação de teste' },
  })
}

async function makeMessage(
  id: string,
  requestId: string,
  authorId: string,
  body: string,
  createdAt = new Date(),
) {
  return prisma.chatMessage.create({
    data: { id, requestId, authorId, body, createdAt, readAt: null },
  })
}

async function setupChat(status = 'Em análise') {
  const adopter = await makeUser('chat-adopter', 'Ana Adotante', {
    phone: '(11) 98888-7777',
    adopterProfile: {
      create: {
        name: 'Ana Adotante',
        email: 'ana.chat@exemplo.com',
        phone: '(11) 98888-7777',
      },
    },
  })
  const guardian = await makeGuardian('chat-guardian')
  const outsider = await makeUser('chat-outsider', 'Visitante', {
    phone: '(11) 97777-6666',
  })
  const pet = await makePet('chat-pet')
  const adoptionRequest = await makeRequest('SOL-CHAT-01', adopter.user.id, pet.id, status)
  const url = `/api/requests/${adoptionRequest.id}/messages`
  return { adopter, guardian, outsider, pet, adoptionRequest, url }
}

databaseSuite('chat da solicitação (#22)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    // App nova por teste: o rate limit tem estado em memória.
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[CHAT-01] só participantes leem e enviam mensagens', async () => {
    const { adopter, guardian, outsider, adoptionRequest, url } = await setupChat()

    expect(await request(app).get(url).set(outsider.headers)).toHaveProperty('status', 403)
    expect(await request(app).post(url).set(outsider.headers).send({ body: 'Oi' })).toHaveProperty(
      'status',
      403,
    )
    expect(
      await request(app).get(`/api/requests/${adoptionRequest.id}`).set(outsider.headers),
    ).toHaveProperty('status', 403)

    expect((await request(app).get(url).set(adopter.headers)).status).toBe(200)
    expect((await request(app).get(url).set(guardian.headers)).status).toBe(200)
    expect(
      (await request(app).post(url).set(adopter.headers).send({ body: 'Do adotante' })).status,
    ).toBe(201)
    expect(
      (await request(app).post(url).set(guardian.headers).send({ body: 'Da instituição' })).status,
    ).toBe(201)
  })

  it('[CHAT-02] mensagem vazia ou acima de 2000 caracteres retorna 400', async () => {
    const { adopter, url } = await setupChat()

    for (const body of ['', '   ', 'x'.repeat(2001)]) {
      const response = await request(app).post(url).set(adopter.headers).send({ body })
      expect(response.status).toBe(400)
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'body' })]),
      )
    }
    expect(await request(app).post(url).set(adopter.headers).send({})).toHaveProperty('status', 400)

    const valid = await request(app)
      .post(url)
      .set(adopter.headers)
      .send({ body: 'x'.repeat(2000) })
    expect(valid.status).toBe(201)
    expect(valid.body.body).toHaveLength(2000)
    expect(await prisma.chatMessage.count()).toBe(1)
  })

  it('[CHAT-03] histórico é paginado por cursor e ordenado por data', async () => {
    const { adopter, adoptionRequest, url } = await setupChat()
    const start = Date.UTC(2026, 0, 1, 12, 0, 0)
    for (let index = 1; index <= 25; index++) {
      await makeMessage(
        `seed-${index}`,
        adoptionRequest.id,
        adopter.user.id,
        `Mensagem ${index}`,
        new Date(start + index * 1000),
      )
    }

    const first = await request(app).get(url).set(adopter.headers)
    expect(first.status).toBe(200)
    expect(first.body.data).toHaveLength(20)
    expect(first.body.data.map((message: { body: string }) => message.body)).toEqual(
      Array.from({ length: 20 }, (_, index) => `Mensagem ${index + 6}`),
    )
    expect(first.body.nextCursor).toBe('seed-6')

    const second = await request(app)
      .get(`${url}?cursor=${first.body.nextCursor}`)
      .set(adopter.headers)
    expect(second.status).toBe(200)
    expect(second.body.data.map((message: { body: string }) => message.body)).toEqual(
      Array.from({ length: 5 }, (_, index) => `Mensagem ${index + 1}`),
    )
    expect(second.body.nextCursor).toBeNull()

    const ids = [...first.body.data, ...second.body.data].map(
      (message: { id: string }) => message.id,
    )
    expect(new Set(ids).size).toBe(25)

    expect(await request(app).get(`${url}?cursor=inexistente`).set(adopter.headers)).toHaveProperty(
      'status',
      400,
    )
    expect(await request(app).get(`${url}?limite=5`).set(adopter.headers)).toHaveProperty(
      'status',
      400,
    )
  })

  it('[CHAT-04] solicitação em estado final deixa o chat somente leitura', async () => {
    const { adopter, guardian, adoptionRequest, url } = await setupChat()
    await makeMessage('seed-1', adoptionRequest.id, guardian.user.id, 'Última mensagem')

    for (const status of ['Aprovada', 'Recusada', 'Cancelada']) {
      await prisma.adoptionRequest.update({ where: { id: adoptionRequest.id }, data: { status } })
      const blocked = await request(app)
        .post(url)
        .set(adopter.headers)
        .send({ body: 'Tarde demais' })
      expect(blocked.status).toBe(409)
    }

    expect((await request(app).get(url).set(adopter.headers)).status).toBe(200)
    expect((await request(app).patch(`${url}/read`).set(adopter.headers)).status).toBe(204)
    expect(await prisma.chatMessage.count()).toBe(1)
  })

  it('[CHAT-05] contagem de não lidas por solicitação e ao marcar como lidas', async () => {
    const { adopter, guardian, adoptionRequest, url } = await setupChat()
    await makeMessage('seed-1', adoptionRequest.id, adopter.user.id, 'Do adotante')
    await makeMessage('seed-2', adoptionRequest.id, adopter.user.id, 'Segunda do adotante')
    await makeMessage('seed-3', adoptionRequest.id, guardian.user.id, 'Da instituição')

    const asAdopter = await request(app).get(url).set(adopter.headers)
    const asGuardian = await request(app).get(url).set(guardian.headers)
    expect(asAdopter.body.unreadCount).toBe(1)
    expect(asGuardian.body.unreadCount).toBe(2)

    const mine = await request(app).get('/api/me/requests').set(adopter.headers)
    expect(mine.body.data[0]).toMatchObject({ id: adoptionRequest.id, unreadMessageCount: 1 })

    expect((await request(app).patch(`${url}/read`).set(adopter.headers)).status).toBe(204)
    expect((await request(app).get(url).set(adopter.headers)).body.unreadCount).toBe(0)
    // A própria mensagem do adotante continua não lida para a instituição.
    expect((await request(app).get(url).set(guardian.headers)).body.unreadCount).toBe(2)

    expect((await request(app).patch(`${url}/read`).set(guardian.headers)).status).toBe(204)
    expect((await request(app).get(url).set(guardian.headers)).body.unreadCount).toBe(0)
  })

  it('[CHAT-06] HTML e script são armazenados e devolvidos como texto puro', async () => {
    const { adopter, url } = await setupChat()
    const body = '<script>alert("xss")</script> <img src=x onerror=alert(1)> Olá'

    const sent = await request(app).post(url).set(adopter.headers).send({ body })
    expect(sent.status).toBe(201)
    expect(sent.body.body).toBe(body)
    expect((await prisma.chatMessage.findUnique({ where: { id: sent.body.id } }))?.body).toBe(body)

    const history = await request(app).get(url).set(adopter.headers)
    expect(history.body.data[0].body).toBe(body)
  })

  it('[CHAT-07] respostas do chat não expõem telefone nem e-mail das partes', async () => {
    const { adopter, guardian, adoptionRequest, url } = await setupChat()
    await makeMessage('seed-1', adoptionRequest.id, adopter.user.id, 'Do adotante')
    await makeMessage('seed-2', adoptionRequest.id, guardian.user.id, 'Da instituição')

    const history = await request(app).get(url).set(adopter.headers)
    const sent = await request(app).post(url).set(adopter.headers).send({ body: 'Mais uma' })
    expect(sent.status).toBe(201)

    const serialized = JSON.stringify([history.body, sent.body])
    for (const contact of [
      'ana.chat@exemplo.com',
      '(11) 98888-7777',
      'chat-guardian@exemplo.com',
      '(11) 3333-4444',
    ]) {
      expect(serialized).not.toContain(contact)
    }
    for (const message of history.body.data) {
      expect(Object.keys(message).sort()).toEqual(
        ['authorName', 'body', 'createdAt', 'id', 'mine', 'readAt'].sort(),
      )
    }
  })

  it('[CHAT-08] envio em excesso retorna 429', async () => {
    const { adopter, url } = await setupChat()
    const limited = createApp({ config: { CHAT_RATE_LIMIT_MAX: 2 } })

    for (const body of ['Primeira', 'Segunda']) {
      expect((await request(limited).post(url).set(adopter.headers).send({ body })).status).toBe(
        201,
      )
    }
    const blocked = await request(limited).post(url).set(adopter.headers).send({ body: 'Terceira' })
    expect(blocked.status).toBe(429)
    expect(blocked.headers['retry-after']).toBeTruthy()
    expect(await prisma.chatMessage.count()).toBe(2)
  })

  it('[CHAT-09] marcar como lido só afeta a própria conversa', async () => {
    const { adopter, guardian, outsider, adoptionRequest, url } = await setupChat()
    await makeMessage('seed-1', adoptionRequest.id, guardian.user.id, 'Da instituição')

    expect((await request(app).patch(`${url}/read`).set(outsider.headers)).status).toBe(403)
    expect((await prisma.chatMessage.findUnique({ where: { id: 'seed-1' } }))?.readAt).toBeNull()

    expect((await request(app).patch(`${url}/read`).set(adopter.headers)).status).toBe(204)
    expect(
      (await prisma.chatMessage.findUnique({ where: { id: 'seed-1' } }))?.readAt,
    ).not.toBeNull()

    const otherPet = await makePet('chat-pet-2')
    const otherRequest = await makeRequest('SOL-CHAT-02', adopter.user.id, otherPet.id)
    await makeMessage('seed-2', otherRequest.id, guardian.user.id, 'Outra conversa')
    expect((await prisma.chatMessage.findUnique({ where: { id: 'seed-2' } }))?.readAt).toBeNull()
  })
})
