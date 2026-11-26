import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { ensureTestOrganization } from '../test/organization.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import {
  APPOINTMENT_CONFIRMED,
  APPOINTMENT_PROPOSED,
  APPOINTMENT_RESCHEDULE_REQUESTED,
} from './events.js'
import { appointmentClock } from './routes/organization.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const ORGANIZATION = 'Instituição Agendamentos'
const OTHER_ORGANIZATION = 'Outra Instituição Agendamentos'
const DAY = 86_400_000
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString()

const ANSWERS = {
  motivation: 'Quero dar um lar cheio de carinho para um pet que precisa de uma segunda chance.',
  routine: 'Trabalho em casa pela manhã e caminho com o pet todas as tardes no parque do bairro.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço calmo e apresentar a rotina da casa aos poucos.',
  costs: true,
  commitment: true,
}

async function makeAdopter(id: string) {
  const user = await prisma.user.create({
    data: {
      id,
      name: 'Ana Souza',
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
    },
  })
  await prisma.adopterProfile.create({ data: { userId: id, name: 'Ana Souza' } })
  const { token } = await signAccessToken(user)
  return { id, headers: bearer(token) }
}

async function makeGuardian(
  id: string,
  organizationRole: 'ADMIN' | 'VOLUNTEER' = 'ADMIN',
  organization = ORGANIZATION,
) {
  const user = await prisma.user.create({
    data: {
      id,
      name: 'Equipe Patinhas',
      email: `${id}@exemplo.com`,
      platformRole: organizationRole === 'ADMIN' ? 'MODERADOR' : 'USUARIO',
      organizationRole,
      role: 'GUARDIAN',
      roles: ['GUARDIAN'],
      organizationName: organization,
    },
  })
  await prisma.guardianProfile.create({
    data: {
      userId: id,
      guardianType: 'ORGANIZATION',
      displayName: organization,
      legalName: organization,
      document: '12.345.678/0001-90',
      email: `${id}@exemplo.com`,
      phone: '(11) 3333-4444',
      acceptsTerms: true,
    },
  })
  const organizationRow = await ensureTestOrganization(organization, 'AG')
  await prisma.membership.create({
    data: {
      userId: id,
      organizationId: organizationRow.id,
      role: organizationRole,
      status: 'ATIVO',
    },
  })
  const { token } = await signAccessToken(user)
  return { id, headers: bearer(token) }
}

async function makePet(id: string, organization = ORGANIZATION) {
  const organizationRow = await ensureTestOrganization(organization, 'AG')
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
      organizationId: organizationRow.id,
      createdAt: new Date(),
      status: 'DISPONIVEL',
    },
  })
}

async function makeRequest(id: string, petId: string, userId: string, status: string) {
  return prisma.adoptionRequest.create({
    data: {
      id,
      petId,
      userId,
      status,
      date: new Date(),
      message: 'Solicitação em análise.',
      answers: ANSWERS,
    },
  })
}

type Headers = { Authorization: string }
const propose = (app: Express, headers: Headers, requestId: string, body: object) =>
  request(app).post(`/api/me/received-requests/${requestId}/appointments`).set(headers).send(body)
const listAppointments = (app: Express, headers: Headers, requestId: string) =>
  request(app).get(`/api/requests/${requestId}/appointments`).set(headers)
const confirm = (
  app: Express,
  headers: Headers,
  requestId: string,
  appointmentId: string,
  confirmedAt: string,
) =>
  request(app)
    .post(`/api/requests/${requestId}/appointments/${appointmentId}/confirm`)
    .set(headers)
    .send({ confirmedAt })
const reschedule = (
  app: Express,
  headers: Headers,
  requestId: string,
  appointmentId: string,
  body: object,
) =>
  request(app)
    .post(`/api/requests/${requestId}/appointments/${appointmentId}/reschedule`)
    .set(headers)
    .send(body)
const complete = (app: Express, headers: Headers, requestId: string, appointmentId: string) =>
  request(app)
    .post(`/api/me/received-requests/${requestId}/appointments/${appointmentId}/complete`)
    .set(headers)
    .send({})

databaseSuite('agendamento de entrevista e visita (#21)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await resetTestDatabase()
  })

  it('[AGD-01] agendamento só no estado correto da solicitação', async () => {
    const guardian = await makeGuardian('org-agd-01')
    await makeAdopter('adopter-agd-01')
    await makePet('pet-agd-01-a')
    await makePet('pet-agd-01-b')
    await makeRequest('SOL-AGD01-A', 'pet-agd-01-a', 'adopter-agd-01', 'ANALISE_QUESTIONARIO')
    await makeRequest('SOL-AGD01-B', 'pet-agd-01-b', 'adopter-agd-01', 'VISITA_DOMICILIAR')

    const visitOutOfStage = await propose(app, guardian.headers, 'SOL-AGD01-A', {
      type: 'VISITA_DOMICILIAR',
      proposedSlots: [future(1)],
    })
    expect(visitOutOfStage.status).toBe(409)

    const interview = await propose(app, guardian.headers, 'SOL-AGD01-A', {
      type: 'ENTREVISTA',
      proposedSlots: [future(2)],
    })
    expect(interview.status).toBe(201)
    expect(interview.body).toMatchObject({ type: 'ENTREVISTA', status: 'PROPOSTO' })

    const visit = await propose(app, guardian.headers, 'SOL-AGD01-B', {
      type: 'VISITA_DOMICILIAR',
      proposedSlots: [future(3)],
    })
    expect(visit.status).toBe(201)

    const interviewOutOfStage = await propose(app, guardian.headers, 'SOL-AGD01-B', {
      type: 'ENTREVISTA',
      proposedSlots: [future(4)],
    })
    expect(interviewOutOfStage.status).toBe(409)
    expect(await prisma.appointment.count()).toBe(2)
  })

  it('[AGD-02] passado retorna 400 e aceita de 1 a 3 horários propostos', async () => {
    const guardian = await makeGuardian('org-agd-02')
    await makeAdopter('adopter-agd-02')
    await makePet('pet-agd-02')
    await makeRequest('SOL-AGD02', 'pet-agd-02', 'adopter-agd-02', 'ENTREVISTA')

    const past = await propose(app, guardian.headers, 'SOL-AGD02', {
      type: 'ENTREVISTA',
      proposedSlots: [new Date(Date.now() - DAY).toISOString()],
    })
    expect(past.status).toBe(400)
    expect(past.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'proposedSlots.0' })]),
    )

    const tooMany = await propose(app, guardian.headers, 'SOL-AGD02', {
      type: 'ENTREVISTA',
      proposedSlots: [future(1), future(2), future(3), future(4)],
    })
    expect(tooMany.status).toBe(400)

    const one = await propose(app, guardian.headers, 'SOL-AGD02', {
      type: 'ENTREVISTA',
      proposedSlots: [future(1)],
    })
    expect(one.status).toBe(201)
    expect(one.body.proposedSlots).toHaveLength(1)

    await makePet('pet-agd-02-b')
    await makeRequest('SOL-AGD02-B', 'pet-agd-02-b', 'adopter-agd-02', 'VISITA_DOMICILIAR')
    const three = await propose(app, guardian.headers, 'SOL-AGD02-B', {
      type: 'VISITA_DOMICILIAR',
      proposedSlots: [future(1), future(2), future(3)],
    })
    expect(three.status).toBe(201)
    expect(three.body.proposedSlots).toHaveLength(3)
  })

  it('[AGD-03] adotante confirma somente um horário proposto', async () => {
    const guardian = await makeGuardian('org-agd-03')
    const adopter = await makeAdopter('adopter-agd-03')
    await makePet('pet-agd-03')
    await makeRequest('SOL-AGD03', 'pet-agd-03', adopter.id, 'ENTREVISTA')

    const proposed = await propose(app, guardian.headers, 'SOL-AGD03', {
      type: 'ENTREVISTA',
      proposedSlots: [future(2), future(3)],
    })
    expect(proposed.status).toBe(201)
    const appointmentId = proposed.body.id as string

    const otherSlot = await confirm(app, adopter.headers, 'SOL-AGD03', appointmentId, future(4))
    expect(otherSlot.status).toBe(400)
    expect(otherSlot.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'confirmedAt' })]),
    )

    const chosen = proposed.body.proposedSlots[1] as string
    const accepted = await confirm(app, adopter.headers, 'SOL-AGD03', appointmentId, chosen)
    expect(accepted.status).toBe(200)
    expect(accepted.body).toMatchObject({ status: 'CONFIRMADO', confirmedAt: chosen })
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })
    expect(stored.confirmedAt?.toISOString()).toBe(chosen)
  })

  it('[AGD-04] não marca REALIZADO antes da data confirmada', async () => {
    const guardian = await makeGuardian('org-agd-04')
    const adopter = await makeAdopter('adopter-agd-04')
    await makePet('pet-agd-04')
    await makeRequest('SOL-AGD04', 'pet-agd-04', adopter.id, 'ENTREVISTA')

    const proposed = await propose(app, guardian.headers, 'SOL-AGD04', {
      type: 'ENTREVISTA',
      proposedSlots: [future(2)],
    })
    const appointmentId = proposed.body.id as string
    const accepted = await confirm(
      app,
      adopter.headers,
      'SOL-AGD04',
      appointmentId,
      proposed.body.proposedSlots[0] as string,
    )
    expect(accepted.status).toBe(200)

    const realNow = Date.now()
    const clock = vi.spyOn(appointmentClock, 'now').mockReturnValue(new Date(realNow + DAY))
    const early = await complete(app, guardian.headers, 'SOL-AGD04', appointmentId)
    expect(early.status).toBe(400)
    expect(early.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'confirmedAt' })]),
    )

    clock.mockReturnValue(new Date(realNow + 3 * DAY))
    const done = await complete(app, guardian.headers, 'SOL-AGD04', appointmentId)
    expect(done.status).toBe(200)
    expect(done.body.status).toBe('REALIZADO')
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })
    expect(stored.status).toBe('REALIZADO')
  })

  it('[AGD-05] cada ação só para quem pode (terceiros recebem 403)', async () => {
    const guardian = await makeGuardian('org-agd-05')
    const outsiderGuardian = await makeGuardian('org-agd-05-out', 'ADMIN', OTHER_ORGANIZATION)
    const adopter = await makeAdopter('adopter-agd-05')
    const outsiderAdopter = await makeAdopter('adopter-agd-05-out')
    await makePet('pet-agd-05')
    await makeRequest('SOL-AGD05', 'pet-agd-05', adopter.id, 'ENTREVISTA')

    const proposed = await propose(app, guardian.headers, 'SOL-AGD05', {
      type: 'ENTREVISTA',
      proposedSlots: [future(2)],
    })
    expect(proposed.status).toBe(201)
    const appointmentId = proposed.body.id as string

    expect(
      (
        await propose(app, outsiderGuardian.headers, 'SOL-AGD05', {
          type: 'ENTREVISTA',
          proposedSlots: [future(3)],
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await propose(app, adopter.headers, 'SOL-AGD05', {
          type: 'ENTREVISTA',
          proposedSlots: [future(3)],
        })
      ).status,
    ).toBe(403)
    expect(
      (await confirm(app, guardian.headers, 'SOL-AGD05', appointmentId, future(3))).status,
    ).toBe(403)
    expect(
      (await confirm(app, outsiderAdopter.headers, 'SOL-AGD05', appointmentId, future(3))).status,
    ).toBe(403)
    expect(
      (await reschedule(app, outsiderAdopter.headers, 'SOL-AGD05', appointmentId, {})).status,
    ).toBe(403)
    expect((await complete(app, outsiderGuardian.headers, 'SOL-AGD05', appointmentId)).status).toBe(
      403,
    )
    expect((await complete(app, adopter.headers, 'SOL-AGD05', appointmentId)).status).toBe(403)

    const confirmed = await confirm(
      app,
      adopter.headers,
      'SOL-AGD05',
      appointmentId,
      proposed.body.proposedSlots[0] as string,
    )
    expect(confirmed.status).toBe(200)
    const reproposed = await reschedule(app, guardian.headers, 'SOL-AGD05', appointmentId, {
      proposedSlots: [future(4)],
    })
    expect(reproposed.status).toBe(200)
  })

  it('[AGD-06] fluxo completo: propor, confirmar e realizar', async () => {
    const guardian = await makeGuardian('org-agd-06')
    const adopter = await makeAdopter('adopter-agd-06')
    await makePet('pet-agd-06')
    await makeRequest('SOL-AGD06', 'pet-agd-06', adopter.id, 'ENTREVISTA')

    const proposed = await propose(app, guardian.headers, 'SOL-AGD06', {
      type: 'ENTREVISTA',
      proposedSlots: [future(2)],
    })
    expect(proposed.status).toBe(201)
    const appointmentId = proposed.body.id as string
    expect(proposed.body).toMatchObject({ status: 'PROPOSTO', confirmedAt: null })

    const confirmed = await confirm(
      app,
      adopter.headers,
      'SOL-AGD06',
      appointmentId,
      proposed.body.proposedSlots[0] as string,
    )
    expect(confirmed.status).toBe(200)
    expect(confirmed.body).toMatchObject({ status: 'CONFIRMADO' })

    vi.spyOn(appointmentClock, 'now').mockReturnValue(new Date(Date.now() + 3 * DAY))
    const completed = await complete(app, guardian.headers, 'SOL-AGD06', appointmentId)
    expect(completed.status).toBe(200)
    expect(completed.body).toMatchObject({ status: 'REALIZADO' })

    const request = await prisma.adoptionRequest.findUniqueOrThrow({
      where: { id: 'SOL-AGD06' },
    })
    expect(request.interview).toMatchObject({
      status: 'REALIZADA',
      completed: true,
      type: 'Entrevista online',
    })
    const types = (await prisma.eventOutbox.findMany({ orderBy: { createdAt: 'asc' } })).map(
      (event) => event.type,
    )
    expect(types).toEqual(
      expect.arrayContaining([APPOINTMENT_PROPOSED, APPOINTMENT_CONFIRMED, APPOINTMENT_CONFIRMED]),
    )
  })

  it('[AGD-07] pedido de remarcação volta ao responsável com novos horários', async () => {
    const guardian = await makeGuardian('org-agd-07')
    const adopter = await makeAdopter('adopter-agd-07')
    await makePet('pet-agd-07')
    await makeRequest('SOL-AGD07', 'pet-agd-07', adopter.id, 'VISITA_DOMICILIAR')

    const proposed = await propose(app, guardian.headers, 'SOL-AGD07', {
      type: 'VISITA_DOMICILIAR',
      proposedSlots: [future(2), future(3)],
    })
    const appointmentId = proposed.body.id as string
    const oldSlot = proposed.body.proposedSlots[0] as string
    await confirm(app, adopter.headers, 'SOL-AGD07', appointmentId, oldSlot)

    const asked = await reschedule(app, adopter.headers, 'SOL-AGD07', appointmentId, {
      notes: 'Preciso trocar o dia.',
    })
    expect(asked.status).toBe(200)
    expect(asked.body).toMatchObject({ status: 'REMARCACAO_SOLICITADA', confirmedAt: null })
    const rescheduleEvents = await prisma.eventOutbox.findMany({
      where: { type: APPOINTMENT_RESCHEDULE_REQUESTED },
    })
    expect(rescheduleEvents).toHaveLength(1)

    const newSlot = future(6)
    const reproposed = await reschedule(app, guardian.headers, 'SOL-AGD07', appointmentId, {
      proposedSlots: [newSlot],
    })
    expect(reproposed.status).toBe(200)
    expect(reproposed.body).toMatchObject({ status: 'PROPOSTO' })
    expect(reproposed.body.proposedSlots).toEqual([newSlot])

    expect((await confirm(app, adopter.headers, 'SOL-AGD07', appointmentId, oldSlot)).status).toBe(
      400,
    )
    expect((await confirm(app, adopter.headers, 'SOL-AGD07', appointmentId, newSlot)).status).toBe(
      200,
    )
    const proposedEvents = await prisma.eventOutbox.findMany({
      where: { type: APPOINTMENT_PROPOSED },
    })
    expect(proposedEvents).toHaveLength(2)
  })

  it('[AGD-08] horários salvos em UTC e devolvidos em ISO 8601', async () => {
    const guardian = await makeGuardian('org-agd-08')
    const adopter = await makeAdopter('adopter-agd-08')
    await makePet('pet-agd-08')
    await makeRequest('SOL-AGD08', 'pet-agd-08', adopter.id, 'VISITA_DOMICILIAR')

    const proposed = await propose(app, guardian.headers, 'SOL-AGD08', {
      type: 'VISITA_DOMICILIAR',
      proposedSlots: ['2030-01-01T10:00:00+02:00'],
    })
    expect(proposed.status).toBe(201)
    const isoUtc = '2030-01-01T08:00:00.000Z'
    expect(proposed.body.proposedSlots).toEqual([isoUtc])
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: proposed.body.id } })
    expect(stored.proposedSlots).toEqual([isoUtc])

    await confirm(app, adopter.headers, 'SOL-AGD08', stored.id, isoUtc)
    const response = await listAppointments(app, adopter.headers, 'SOL-AGD08')
    expect(response.status).toBe(200)
    expect(response.body.total).toBe(1)
    expect(response.body.data[0]).toMatchObject({
      confirmedAt: isoUtc,
      proposedSlots: [isoUtc],
    })
    expect(new Date(response.body.data[0].confirmedAt).toISOString()).toBe(isoUtc)
    for (const field of ['createdAt', 'updatedAt'] as const) {
      expect(response.body.data[0][field]).toMatch(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/)
    }
  })

  it('[AGD-09] usuário sem vínculo não lê o agendamento', async () => {
    const guardian = await makeGuardian('org-agd-09')
    const outsiderGuardian = await makeGuardian('org-agd-09-out', 'ADMIN', OTHER_ORGANIZATION)
    const adopter = await makeAdopter('adopter-agd-09')
    const outsider = await makeAdopter('adopter-agd-09-out')
    await makePet('pet-agd-09')
    await makeRequest('SOL-AGD09', 'pet-agd-09', adopter.id, 'ENTREVISTA')
    await propose(app, guardian.headers, 'SOL-AGD09', {
      type: 'ENTREVISTA',
      proposedSlots: [future(2)],
    })

    expect((await listAppointments(app, outsider.headers, 'SOL-AGD09')).status).toBe(403)
    expect((await listAppointments(app, outsiderGuardian.headers, 'SOL-AGD09')).status).toBe(403)
    const asAdopter = await listAppointments(app, adopter.headers, 'SOL-AGD09')
    expect(asAdopter.status).toBe(200)
    expect(asAdopter.body.data).toHaveLength(1)
    const asGuardian = await listAppointments(app, guardian.headers, 'SOL-AGD09')
    expect(asGuardian.status).toBe(200)
    expect(asGuardian.body.data).toHaveLength(1)
  })
})
