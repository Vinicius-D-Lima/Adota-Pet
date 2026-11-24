import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { ensureTestOrganization } from '../test/organization.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { NEW_REQUEST_FOR_ORGANIZATION } from './events.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

const QUESTIONNAIRE = {
  motivation: 'Quero dar um lar cheio de carinho para um pet que precisa de uma segunda chance.',
  routine: 'Trabalho em casa pela manhã e caminho com o pet todas as tardes no parque do bairro.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço calmo e apresentar a rotina da casa aos poucos.',
  costs: true,
  commitment: true,
} as const

const PROFILE = {
  name: 'Ana Souza',
  cpf: '529.982.247-25',
  birthDate: '1990-05-10',
  email: 'ana@exemplo.com',
  phone: '(11) 98888-7777',
  zipCode: '01310-100',
  address: 'Avenida Paulista, 1000',
  housing: 'Apartamento',
  hasOutdoorArea: false,
  dailyTime: '2 a 3 horas',
  activityLevel: 'Moderado',
  hasChildren: false,
  hasOtherPets: false,
  experience: 'Já tive pets',
  acceptsSpecialCare: true,
  preferredSpecies: 'Cachorro',
  preferredSize: 'Médio ou grande',
} as const

const ORGANIZATION = 'Instituição Patinhas'

async function makeAdopter(id: string, completeProfile = true) {
  const user = await prisma.user.create({
    data: {
      id,
      name: PROFILE.name,
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
    },
  })
  if (completeProfile) {
    await prisma.adopterProfile.create({ data: { userId: id, ...PROFILE } })
  }
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makePet(id: string, status = 'DISPONIVEL', organization = ORGANIZATION) {
  const organizationRow = await ensureTestOrganization(organization, 'IP')
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
      organizationId: organizationRow.id,
      createdAt: new Date(),
      status,
    },
  })
}

async function makeGuardian(id: string, organization = ORGANIZATION) {
  const user = await prisma.user.create({
    data: {
      id,
      name: 'Equipe Patinhas',
      email: `${id}@exemplo.com`,
      platformRole: 'MODERADOR',
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
      zipCode: '01310-100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      description: 'Organização de proteção animal',
      acceptsTerms: true,
    },
  })
  const organizationRow = await ensureTestOrganization(organization, 'IP')
  await prisma.membership.create({
    data: { userId: id, organizationId: organizationRow.id, role: 'ADMIN', status: 'ATIVO' },
  })
  const { token } = await signAccessToken(user)
  return { headers: bearer(token) }
}

const postRequest = (app: Express, headers: Record<string, string>, body: object) =>
  request(app).post('/api/requests').set(headers).send(body)

databaseSuite('criação e leitura de solicitações (#50)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    // App nova por teste: o rate limit tem estado em memória.
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[REQ-01] cada regra violada do questionário retorna 400 com o campo em details', async () => {
    const { headers } = await makeAdopter('req-01')
    await makePet('req-01-pet')

    const cases: Array<{ body: object; field: string }> = [
      { body: { answers: QUESTIONNAIRE }, field: 'petId' },
      { body: { petId: 'req-01-pet' }, field: 'answers' },
      {
        body: { petId: 'req-01-pet', answers: { ...QUESTIONNAIRE, motivation: 'curto' } },
        field: 'answers.motivation',
      },
      {
        body: { petId: 'req-01-pet', answers: { ...QUESTIONNAIRE, routine: 'curto' } },
        field: 'answers.routine',
      },
      {
        body: { petId: 'req-01-pet', answers: { ...QUESTIONNAIRE, adaptation: 'curto' } },
        field: 'answers.adaptation',
      },
      {
        body: { petId: 'req-01-pet', answers: { ...QUESTIONNAIRE, aloneTime: 'Qualquer tempo' } },
        field: 'answers.aloneTime',
      },
      {
        body: { petId: 'req-01-pet', answers: { ...QUESTIONNAIRE, costs: false } },
        field: 'answers.costs',
      },
      {
        body: { petId: 'req-01-pet', answers: { ...QUESTIONNAIRE, commitment: false } },
        field: 'answers.commitment',
      },
    ]

    for (const { body, field } of cases) {
      const response = await postRequest(app, headers, body)
      expect(response.status).toBe(400)
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      )
    }
    expect(await prisma.adoptionRequest.count()).toBe(0)
  })

  it('[REQ-02] uma solicitação ativa por adotante e pet; cancelada ou recusada libera nova', async () => {
    const { headers } = await makeAdopter('req-02')
    await makePet('req-02-pet')
    const body = { petId: 'req-02-pet', answers: QUESTIONNAIRE }

    const first = await postRequest(app, headers, body)
    expect(first.status).toBe(201)

    const duplicate = await postRequest(app, headers, body)
    expect(duplicate.status).toBe(409)

    const cancelled = await request(app)
      .post(`/api/requests/${first.body.id}/transitions`)
      .set(headers)
      .send({ to: 'CANCELADA' })
    expect(cancelled.status).toBe(200)

    const afterCancel = await postRequest(app, headers, body)
    expect(afterCancel.status).toBe(201)

    await prisma.adoptionRequest.update({
      where: { id: afterCancel.body.id },
      data: { status: 'Recusada' },
    })
    const afterReject = await postRequest(app, headers, body)
    expect(afterReject.status).toBe(201)
  })

  it('[REQ-03] pet adotado ou arquivado retorna 409', async () => {
    const { headers } = await makeAdopter('req-03')
    for (const [index, status] of ['ADOTADO', 'ARQUIVADO'].entries()) {
      const petId = `req-03-pet-${index}`
      await makePet(petId, status)
      const response = await postRequest(app, headers, { petId, answers: QUESTIONNAIRE })
      expect(response.status).toBe(409)
    }
    expect(await prisma.adoptionRequest.count()).toBe(0)
  })

  it('[REQ-04] perfil incompleto retorna 422 com a lista de campos faltantes', async () => {
    const { headers } = await makeAdopter('req-04', false)
    await makePet('req-04-pet')

    const response = await postRequest(app, headers, {
      petId: 'req-04-pet',
      answers: QUESTIONNAIRE,
    })
    expect(response.status).toBe(422)
    const fields = response.body.details.map((detail: { field: string }) => detail.field)
    expect(fields).toEqual(expect.arrayContaining(['cpf', 'housing', 'dailyTime']))
    expect(await prisma.adoptionRequest.count()).toBe(0)
  })

  it('[REQ-05] usuário sem vínculo não lê a solicitação (BOLA/IDOR)', async () => {
    const adopter = await makeAdopter('req-05')
    await makePet('req-05-pet')
    const created = await postRequest(app, adopter.headers, {
      petId: 'req-05-pet',
      answers: QUESTIONNAIRE,
    })
    expect(created.status).toBe(201)

    const outsider = await makeAdopter('req-05-outsider')
    const denied = await request(app).get(`/api/requests/${created.body.id}`).set(outsider.headers)
    expect(denied.status).toBe(403)

    const owner = await request(app).get(`/api/requests/${created.body.id}`).set(adopter.headers)
    expect(owner.status).toBe(200)

    const guardian = await makeGuardian('req-05-guardian')
    const allowed = await request(app).get(`/api/requests/${created.body.id}`).set(guardian.headers)
    expect(allowed.status).toBe(200)
  })

  it('[REQ-06] status, adopterId e id do corpo são ignorados (mass assignment)', async () => {
    const { headers, user } = await makeAdopter('req-06')
    await makePet('req-06-pet')

    const response = await postRequest(app, headers, {
      petId: 'req-06-pet',
      id: 'SOL-9999',
      adopterId: 'req-05-outsider',
      userId: 'req-05-outsider',
      status: 'Aprovada',
      answers: { ...QUESTIONNAIRE, status: 'Aprovada', adopterId: 'req-05-outsider' },
    })
    expect(response.status).toBe(201)
    expect(response.body.status).toBe('Enviada')
    expect(response.body.id).toMatch(/^SOL-\d{4,}$/)
    expect(response.body.id).not.toBe('SOL-9999')
    expect(response.body.answers).toEqual(QUESTIONNAIRE)

    const stored = await prisma.adoptionRequest.findUnique({ where: { id: response.body.id } })
    expect(stored?.userId).toBe(user.id)
    expect(stored?.status).toBe('ENVIADA')
    expect(stored?.answers).toEqual(QUESTIONNAIRE)
  })

  it('[REQ-07] duas requisições simultâneas criam só uma solicitação', async () => {
    const { headers } = await makeAdopter('req-07')
    await makePet('req-07-pet')
    const body = { petId: 'req-07-pet', answers: QUESTIONNAIRE }

    const [first, second] = await Promise.all([
      postRequest(app, headers, body),
      postRequest(app, headers, body),
    ])
    expect([first.status, second.status].sort()).toEqual([201, 409])
    expect(await prisma.adoptionRequest.count({ where: { petId: 'req-07-pet' } })).toBe(1)
    expect(await prisma.eventOutbox.count()).toBe(1)
  })

  it('[REQ-08] ids únicos e data gerada pelo servidor', async () => {
    const { headers } = await makeAdopter('req-08')
    await makePet('req-08-pet-1')
    await makePet('req-08-pet-2')

    const before = Date.now()
    const first = await postRequest(app, headers, {
      petId: 'req-08-pet-1',
      answers: QUESTIONNAIRE,
    })
    const second = await postRequest(app, headers, {
      petId: 'req-08-pet-2',
      answers: QUESTIONNAIRE,
    })
    const after = Date.now()

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(first.body.id).not.toBe(second.body.id)
    for (const response of [first, second]) {
      expect(response.body.id).toMatch(/^SOL-\d{4,}$/)
      const date = new Date(response.body.date).getTime()
      expect(date).toBeGreaterThanOrEqual(before - 1000)
      expect(date).toBeLessThanOrEqual(after + 1000)
    }
  })

  it('[REQ-09] respostas do questionário são texto puro (XSS)', async () => {
    const { headers } = await makeAdopter('req-09')
    await makePet('req-09-pet')
    const payload = `<script>alert('xss')</script> ${'a'.repeat(60)}`

    const created = await postRequest(app, headers, {
      petId: 'req-09-pet',
      answers: { ...QUESTIONNAIRE, motivation: payload },
    })
    expect(created.status).toBe(201)
    expect(created.body.answers.motivation).toBe(payload)

    const stored = await prisma.adoptionRequest.findUnique({ where: { id: created.body.id } })
    expect((stored?.answers as { motivation: string }).motivation).toBe(payload)

    const read = await request(app).get(`/api/requests/${created.body.id}`).set(headers)
    expect(read.body.answers.motivation).toBe(payload)
    expect(JSON.stringify(read.body)).toContain('<script>')
  })

  it('[REQ-10] criar a solicitação enfileira NewRequestForOrganization', async () => {
    const { headers } = await makeAdopter('req-10')
    await makePet('req-10-pet')

    const response = await postRequest(app, headers, {
      petId: 'req-10-pet',
      answers: QUESTIONNAIRE,
    })
    expect(response.status).toBe(201)

    const events = await prisma.eventOutbox.findMany({
      where: { type: NEW_REQUEST_FOR_ORGANIZATION },
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toEqual({
      requestId: response.body.id,
      petId: 'req-10-pet',
      adopterId: 'req-10',
      organization: ORGANIZATION,
      createdAt: expect.any(String),
    })
  })
})
