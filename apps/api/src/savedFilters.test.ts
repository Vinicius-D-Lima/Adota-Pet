import type { Express } from 'express'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { NEW_MATCHING_PET, type DomainEventPayload } from './events.js'
import type { Prisma } from './generated/prisma/client.js'
import { processDailyDigest, QUEUES, SCHEDULES } from './jobs.js'
import { notificationHandlerFor, setEmailTransport } from './notificationService.js'
import { savedFiltersRouter } from './routes/savedFilters.js'
import { notifyMatchingSavedFilters, type MatchingPet } from './savedFilterAlerts.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

const CRITERIA = {
  search: 'Luna',
  species: 'Cachorro',
  size: ['Médio'],
  sex: 'Fêmea',
  city: 'São Paulo',
}

type PetFields = Pick<MatchingPet, 'name' | 'species' | 'size' | 'sex' | 'city'>

const PET_FIELDS: PetFields = {
  name: 'Luna',
  species: 'Cachorro',
  size: 'Médio',
  sex: 'Fêmea',
  city: 'São Paulo',
}

const validationApp = express()
validationApp.use(express.json())
validationApp.use(savedFiltersRouter)

async function makeUser(id: string) {
  const user = await prisma.user.create({
    data: {
      id,
      name: id,
      email: `${id}@exemplo.com`,
    },
  })
  const { token } = await signAccessToken(user)
  return bearer(token)
}

/** Usuário com uma busca salva já persistida (atalho dos testes de alerta). */
async function makeFilterOwner(id: string, criteria: Record<string, unknown>, active = true) {
  const user = await prisma.user.create({
    data: { id, name: id, email: `${id}@exemplo.com` },
  })
  await prisma.savedFilter.create({
    data: {
      id: `${id}-filter`,
      userId: id,
      name: `Filtro ${id}`,
      criteria: criteria as unknown as Prisma.InputJsonValue,
      active,
      createdAt: new Date(),
    },
  })
  return user
}

async function createOrganization(id: string, name: string) {
  return prisma.organization.create({
    data: { id, name, initials: name.slice(0, 2).toUpperCase() },
  })
}

async function createPet(id: string, organizationId: string, overrides: Partial<PetFields> = {}) {
  const fields = { ...PET_FIELDS, ...overrides }
  await prisma.pet.create({
    data: {
      id,
      organizationId,
      ...fields,
      breed: 'SRD',
      age: 2,
      ageLabel: '2 anos',
      image: 'https://example.com/pet.jpg',
      summary: 'Pet dócil',
      description: 'Pet dócil e brincalhão',
      traits: ['doce'],
      energy: 'Moderada',
      space: 'Quintal',
      children: true,
      otherPets: true,
      status: 'DISPONIVEL',
      createdAt: new Date(),
    },
  })
}

function petInput(
  id: string,
  organizationId: string,
  overrides: Partial<PetFields> = {},
): MatchingPet {
  return { id, organizationId, ...PET_FIELDS, ...overrides }
}

/** Entrega os eventos publicados ao consumidor real de notificações (#30). */
async function deliverMatchingEvents() {
  const events = await prisma.eventOutbox.findMany({
    where: { type: NEW_MATCHING_PET },
    orderBy: { createdAt: 'asc' },
  })
  for (const event of events) {
    await notificationHandlerFor(NEW_MATCHING_PET)(event.payload as DomainEventPayload)
  }
  return events
}

const postSavedFilter = (app: Express, headers: Record<string, string>, name: string) =>
  request(app).post('/api/me/saved-filters').set(headers).send({
    name,
    criteria: CRITERIA,
    active: true,
  })

describe('validação de filtros salvos (#31)', () => {
  it('[FIL-01] critérios desconhecidos e valores fora do enum retornam 400', async () => {
    const invalidCriteria = [
      { ...CRITERIA, unknown: 'valor' },
      { ...CRITERIA, species: 'Pássaro' },
      { ...CRITERIA, species: ['Cachorro'] },
      { ...CRITERIA, size: 'Médio' },
      { ...CRITERIA, sex: 'Outro' },
      { ...CRITERIA, search: 12 },
      { ...CRITERIA, city: ' ' },
    ]

    for (const criteria of invalidCriteria) {
      const response = await request(validationApp)
        .post('/me/saved-filters')
        .send({ name: 'Filtro inválido', criteria, active: true })

      expect(response.status).toBe(400)
    }
  })

  it('[FIL-07] critérios com chaves arbitrárias ou __proto__ são rejeitados', async () => {
    const arbitraryKey = await request(validationApp)
      .post('/me/saved-filters')
      .send({
        name: 'Filtro inválido',
        criteria: { ...CRITERIA, $where: 'this.active === true' },
        active: true,
      })
    const prototypeKey = await request(validationApp)
      .post('/me/saved-filters')
      .set('Content-Type', 'application/json')
      .send(
        '{"name":"Filtro inválido","criteria":{"species":"Cachorro","__proto__":{"polluted":true}},"active":true}',
      )

    expect(arbitraryKey.status).toBe(400)
    expect(prototypeKey.status).toBe(400)
  })
})

databaseSuite('filtros salvos (#31)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    setEmailTransport(null)
    await resetTestDatabase()
  })

  it('[FIL-02] o 11º filtro do mesmo usuário retorna 409', async () => {
    const headers = await makeUser('fil-02')

    for (let index = 1; index <= 9; index += 1) {
      const response = await postSavedFilter(app, headers, `Filtro ${index}`)
      expect(response.status).toBe(201)
    }

    const concurrent = await Promise.all([
      postSavedFilter(app, headers, 'Filtro simultâneo A'),
      postSavedFilter(app, headers, 'Filtro simultâneo B'),
    ])
    expect(concurrent.map(({ status }) => status).sort((a, b) => a - b)).toEqual([201, 409])
    expect(await prisma.savedFilter.count()).toBe(10)

    const eleventh = await postSavedFilter(app, headers, 'Filtro 11')

    expect(eleventh.status).toBe(409)
    expect(await prisma.savedFilter.count()).toBe(10)
  })

  it('[FIL-03] pet compatível publica NewMatchingPet para o dono do filtro', async () => {
    const organization = await createOrganization('org-fil-03', 'ONG FIL 03')
    await makeFilterOwner('fil-03-owner', { ...CRITERIA, search: 'uNa' })
    await makeFilterOwner('fil-03-other', { ...CRITERIA, species: 'Gato' })
    await makeFilterOwner('fil-03-empty', {})
    await createPet('pet-fil-03', organization.id)

    const payloads = await notifyMatchingSavedFilters(petInput('pet-fil-03', organization.id))

    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      userId: 'fil-03-owner',
      petId: 'pet-fil-03',
      petName: 'Luna',
      filterId: 'fil-03-owner-filter',
    })
    const events = await deliverMatchingEvents()
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({ userId: 'fil-03-owner', petId: 'pet-fil-03' })
    expect(
      await prisma.notification.findFirstOrThrow({ where: { userId: 'fil-03-owner' } }),
    ).toMatchObject({
      type: NEW_MATCHING_PET,
      link: '/pets/pet-fil-03',
    })
  })

  it('[FIL-04] filtro inativo nunca dispara', async () => {
    const organization = await createOrganization('org-fil-04', 'ONG FIL 04')
    await makeFilterOwner('fil-04-inactive', CRITERIA, false)
    await makeFilterOwner('fil-04-active', CRITERIA, true)
    await createPet('pet-fil-04', organization.id)

    const payloads = await notifyMatchingSavedFilters(petInput('pet-fil-04', organization.id))

    expect(payloads.map(({ userId }) => userId)).toEqual(['fil-04-active'])
    expect(await prisma.eventOutbox.count({ where: { type: NEW_MATCHING_PET } })).toBe(1)
  })

  it('[FIL-05] o mesmo pet gera no máximo um alerta por usuário', async () => {
    const organization = await createOrganization('org-fil-05', 'ONG FIL 05')
    await makeFilterOwner('fil-05-owner', CRITERIA)
    await prisma.savedFilter.create({
      data: {
        id: 'fil-05-owner-filter-2',
        userId: 'fil-05-owner',
        name: 'Segunda busca compatível',
        criteria: { search: 'Luna' } as unknown as Prisma.InputJsonValue,
        active: true,
        createdAt: new Date(Date.now() + 1000),
      },
    })
    await makeFilterOwner('fil-05-other', { species: 'Cachorro', size: ['Médio'] })
    await createPet('pet-fil-05', organization.id)

    const payloads = await notifyMatchingSavedFilters(petInput('pet-fil-05', organization.id))

    expect(payloads).toHaveLength(2)
    expect(payloads.find(({ userId }) => userId === 'fil-05-owner')?.filterId).toBe(
      'fil-05-owner-filter',
    )
    expect(await prisma.eventOutbox.count({ where: { type: NEW_MATCHING_PET } })).toBe(2)
    await deliverMatchingEvents()
    expect(await prisma.notification.count({ where: { userId: 'fil-05-owner' } })).toBe(1)
    expect(await prisma.notification.count({ where: { userId: 'fil-05-other' } })).toBe(1)
  })

  it('[FIL-06] somente o dono lista, edita ou apaga o filtro', async () => {
    const ownerHeaders = await makeUser('fil-06-owner')
    const otherHeaders = await makeUser('fil-06-other')
    const created = await postSavedFilter(app, ownerHeaders, 'Filtro da dona')
    const filterId = created.body.id as string

    const otherList = await request(app).get('/api/me/saved-filters').set(otherHeaders)
    const forbiddenUpdate = await request(app)
      .patch(`/api/me/saved-filters/${filterId}`)
      .set(otherHeaders)
      .send({ name: 'Alterado por outra pessoa' })
    const forbiddenDelete = await request(app)
      .delete(`/api/me/saved-filters/${filterId}`)
      .set(otherHeaders)

    expect(otherList.body).toMatchObject({ data: [], total: 0 })
    expect(forbiddenUpdate.status).toBe(404)
    expect(forbiddenDelete.status).toBe(404)

    const ownerList = await request(app).get('/api/me/saved-filters').set(ownerHeaders)
    expect(ownerList.body.data).toHaveLength(1)
    expect(ownerList.body.data[0]).toMatchObject({ id: filterId, name: 'Filtro da dona' })
    expect(ownerList.body.data[0]).not.toHaveProperty('userId')

    const ownerUpdate = await request(app)
      .patch(`/api/me/saved-filters/${filterId}`)
      .set(ownerHeaders)
      .send({ name: 'Filtro atualizado' })
    expect(ownerUpdate.status).toBe(200)
    expect(ownerUpdate.body.name).toBe('Filtro atualizado')

    const ownerDelete = await request(app)
      .delete(`/api/me/saved-filters/${filterId}`)
      .set(ownerHeaders)
    expect(ownerDelete.status).toBe(204)
    expect(await prisma.savedFilter.count()).toBe(0)
  })

  it('[FIL-08] membros ativos da organização do pet não são notificados', async () => {
    const organization = await createOrganization('org-fil-08', 'ONG FIL 08')
    for (const id of ['fil-08-admin', 'fil-08-member', 'fil-08-removed', 'fil-08-outsider']) {
      await makeFilterOwner(id, CRITERIA)
    }
    await prisma.membership.createMany({
      data: [
        {
          id: 'membership-fil-08-admin',
          userId: 'fil-08-admin',
          organizationId: organization.id,
          role: 'ADMIN',
          status: 'ATIVO',
          joinedAt: new Date(),
        },
        {
          id: 'membership-fil-08-member',
          userId: 'fil-08-member',
          organizationId: organization.id,
          role: 'VOLUNTEER',
          status: 'ATIVO',
          joinedAt: new Date(),
        },
        {
          id: 'membership-fil-08-removed',
          userId: 'fil-08-removed',
          organizationId: organization.id,
          role: 'VOLUNTEER',
          status: 'REMOVIDO',
          joinedAt: new Date(),
        },
      ],
    })
    await createPet('pet-fil-08', organization.id)

    const payloads = await notifyMatchingSavedFilters(petInput('pet-fil-08', organization.id))

    expect(payloads.map(({ userId }) => userId).sort()).toEqual([
      'fil-08-outsider',
      'fil-08-removed',
    ])
  })

  it('[FIL-09] resumo diário agrupa alertas não lidos e envia um e-mail', async () => {
    expect(SCHEDULES.find(({ queue }) => queue === QUEUES.dailyDigest)).toMatchObject({
      queue: QUEUES.dailyDigest,
      cron: '0 7 * * *',
    })

    const organization = await createOrganization('org-fil-09', 'ONG FIL 09')
    // Sem `search`: os dois pets do dia precisam bater no mesmo filtro.
    await makeFilterOwner('fil-09-owner', {
      species: 'Cachorro',
      size: ['Médio'],
      sex: 'Fêmea',
      city: 'São Paulo',
    })
    await createPet('pet-fil-09-a', organization.id)
    await createPet('pet-fil-09-b', organization.id, { name: 'Mel' })
    await notifyMatchingSavedFilters(petInput('pet-fil-09-a', organization.id))
    await notifyMatchingSavedFilters(petInput('pet-fil-09-b', organization.id, { name: 'Mel' }))
    await deliverMatchingEvents()
    expect(await prisma.notification.count({ where: { userId: 'fil-09-owner' } })).toBe(2)

    const sent: Array<{ to: string; subject: string; text: string }> = []
    setEmailTransport({
      async sendMail(mail) {
        sent.push({
          to: String(mail.to),
          subject: String(mail.subject),
          text: String(mail.text),
        })
        return { envelope: {} as never, messageId: 'fil-09' }
      },
    })

    try {
      const result = await processDailyDigest(new Date())
      expect(result).toMatchObject({ users: 1, notifications: 2, emailsSent: 1 })
      expect(sent).toHaveLength(1)
      expect(sent[0].to).toBe('fil-09-owner@exemplo.com')
      expect(sent[0].text).toContain('Luna')
      expect(sent[0].text).toContain('Mel')

      // Redelivery do mesmo dia e alertas já lidos não geram novos e-mails.
      expect((await processDailyDigest(new Date())).emailsSent).toBe(0)
      await prisma.notification.updateMany({
        where: { userId: 'fil-09-owner' },
        data: { readAt: new Date() },
      })
      expect((await processDailyDigest(new Date())).emailsSent).toBe(0)
    } finally {
      setEmailTransport(null)
    }
  })
})
