import { receivedRequestsResponseSchema, type OrganizationRole } from '@adotapet/shared'
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

const ADOPTER_PROFILE = {
  name: 'Ana Souza',
  cpf: '529.982.247-25',
  birthDate: '1990-05-10',
  email: 'ana@exemplo.com',
  phone: '(11) 98888-7777',
  zipCode: '01310-100',
  address: 'Avenida Paulista, 1000',
  housing: 'Apartamento',
  hasOutdoorArea: false,
  dailyTime: 'Até 1 hora',
  activityLevel: 'Tranquilo',
  hasChildren: false,
  hasOtherPets: false,
  experience: 'Primeiro pet',
  acceptsSpecialCare: false,
  preferredSpecies: 'Cachorro',
  preferredSize: 'Médio ou grande',
} as const

const ANSWERS = {
  motivation: 'Quero dar um lar cheio de carinho para um pet que precisa de uma segunda chance.',
  routine: 'Trabalho em casa pela manhã e caminho com o pet todas as tardes no parque do bairro.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço calmo e apresentar a rotina da casa aos poucos.',
  costs: true,
  commitment: true,
} as const

async function makeAdopter(id: string) {
  const user = await prisma.user.create({
    data: {
      id,
      name: ADOPTER_PROFILE.name,
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
    },
  })
  await prisma.adopterProfile.create({ data: { userId: id, ...ADOPTER_PROFILE } })
  const { token } = await signAccessToken(user)
  return { headers: bearer(token) }
}

async function makeGuardian(id: string, organizationRole: OrganizationRole = 'ADMIN') {
  const user = await prisma.user.create({
    data: {
      id,
      name: 'Equipe Patinhas',
      email: `${id}@exemplo.com`,
      // MODERADOR sempre é ADMIN; voluntário precisa de PlatformRole comum.
      platformRole: organizationRole === 'ADMIN' ? 'MODERADOR' : 'USUARIO',
      organizationRole,
      role: 'GUARDIAN',
      roles: ['GUARDIAN'],
      organizationName: ORGANIZATION,
    },
  })
  await prisma.guardianProfile.create({
    data: {
      userId: id,
      guardianType: 'ORGANIZATION',
      displayName: ORGANIZATION,
      legalName: ORGANIZATION,
      document: '12.345.678/0001-90',
      email: `${id}@exemplo.com`,
      phone: '(11) 3333-4444',
      zipCode: '01310-100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      acceptsTerms: true,
    },
  })
  const organization = await ensureTestOrganization(ORGANIZATION, 'IP')
  await prisma.membership.create({
    data: {
      userId: id,
      organizationId: organization.id,
      role: organizationRole,
      status: 'ATIVO',
    },
  })
  const { token } = await signAccessToken(user)
  return { headers: bearer(token) }
}

async function makePet(
  id: string,
  overrides: Partial<{ organization: string; energy: string; space: string }> = {},
) {
  const organization = await ensureTestOrganization(overrides.organization ?? ORGANIZATION, 'IP')
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
      energy: overrides.energy ?? 'Moderada',
      space: overrides.space ?? 'Apartamento',
      children: true,
      otherPets: true,
      organizationId: organization.id,
      createdAt: new Date(),
      status: 'DISPONIVEL',
    },
  })
}

const completedInterview = {
  type: 'Entrevista online',
  proposedSlots: [new Date(Date.now() + 86_400_000).toISOString()],
  status: 'REALIZADA',
  completed: true,
  scheduledAt: new Date(Date.now() - 86_400_000).toISOString(),
  completedAt: new Date().toISOString(),
}

async function makeRequest(
  id: string,
  petId: string,
  userId: string,
  status: string,
  interview?: object,
) {
  return prisma.adoptionRequest.create({
    data: {
      id,
      petId,
      userId,
      status,
      date: new Date(),
      message: 'Solicitação em análise.',
      answers: ANSWERS,
      interview: interview ?? undefined,
    },
  })
}

databaseSuite('área da instituição: RBAC, fila e compatibilidade (#26/#28)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[RBAC-01] voluntário não aprova mesmo enviando X-Demo-Role: ADMIN', async () => {
    const { headers } = await makeGuardian('org-rbac-01', 'VOLUNTEER')
    await makeAdopter('adopter-rbac-01')
    await makePet('pet-rbac-01')
    await makeRequest(
      'SOL-RBAC-01',
      'pet-rbac-01',
      'adopter-rbac-01',
      'ANALISE_QUESTIONARIO',
      completedInterview,
    )

    const response = await request(app)
      .post('/api/me/received-requests/SOL-RBAC-01/transitions')
      .set(headers)
      .set('X-Demo-Role', 'ADMIN')
      .send({ to: 'APROVADA' })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
    const unchanged = await prisma.adoptionRequest.findUnique({ where: { id: 'SOL-RBAC-01' } })
    expect(unchanged?.status).toBe('ANALISE_QUESTIONARIO')
  })

  it('[RBAC-02] administrador aprova após entrevista realizada', async () => {
    const { headers } = await makeGuardian('org-rbac-02')
    await makeAdopter('adopter-rbac-02')
    await makePet('pet-rbac-02')
    await makeRequest(
      'SOL-RBAC-02',
      'pet-rbac-02',
      'adopter-rbac-02',
      'Em análise',
      completedInterview,
    )

    const response = await request(app)
      .post('/api/me/received-requests/SOL-RBAC-02/transitions')
      .set(headers)
      .send({ to: 'APROVADA' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: 'SOL-RBAC-02', status: 'Aprovada' })
  })

  it('[RBAC-03] /me/permissions reflete o papel persistido no banco', async () => {
    const volunteer = await makeGuardian('org-rbac-03v', 'VOLUNTEER')
    const admin = await makeGuardian('org-rbac-03a')

    const volunteerResponse = await request(app).get('/api/me/permissions').set(volunteer.headers)
    expect(volunteerResponse.status).toBe(200)
    expect(volunteerResponse.body).toMatchObject({
      role: 'VOLUNTEER',
      canApprove: false,
    })
    expect(volunteerResponse.body.permissions).not.toContain('requests:approve')

    const adminResponse = await request(app).get('/api/me/permissions').set(admin.headers)
    expect(adminResponse.body).toMatchObject({ role: 'ADMIN', canApprove: true })
    expect(adminResponse.body.permissions).toContain('requests:approve')
  })

  it('[RBAC-04] voluntário pode avançar e recusar, mas não aprovar', async () => {
    const { headers } = await makeGuardian('org-rbac-04', 'VOLUNTEER')
    await makeAdopter('adopter-rbac-04')
    await makePet('pet-rbac-04')
    await makeRequest('SOL-RBAC-04', 'pet-rbac-04', 'adopter-rbac-04', 'Enviada')

    const advance = await request(app)
      .post('/api/me/received-requests/SOL-RBAC-04/transitions')
      .set(headers)
      .send({ to: 'EM_ANALISE' })
    expect(advance.status).toBe(200)

    const reject = await request(app)
      .post('/api/me/received-requests/SOL-RBAC-04/transitions')
      .set(headers)
      .send({ to: 'RECUSADA', reason: 'Perfil incompatível com as necessidades do pet.' })
    expect(reject.status).toBe(200)
    expect(reject.body).toMatchObject({ status: 'Recusada' })
  })

  it('[ORGQ-01] filtra por etapa e pet no servidor e devolve contadores da fila filtrada', async () => {
    const { headers } = await makeGuardian('org-org-01')
    await makeAdopter('adopter-org-a1')
    await makeAdopter('adopter-org-a2')
    await makeAdopter('adopter-org-b1')
    await makePet('pet-org-a')
    await makePet('pet-org-b')
    await makeRequest('SOL-ORG-A1', 'pet-org-a', 'adopter-org-a1', 'Enviada')
    await makeRequest('SOL-ORG-A2', 'pet-org-a', 'adopter-org-a2', 'Em análise', completedInterview)
    await makeRequest('SOL-ORG-B1', 'pet-org-b', 'adopter-org-b1', 'Recusada')

    const all = await request(app).get('/api/me/received-requests').set(headers)
    expect(all.status).toBe(200)
    expect(receivedRequestsResponseSchema.parse(all.body)).toMatchObject({
      total: 3,
      counters: { all: 3, new: 1, interview: 0, 'interview-done': 1, approved: 0, closed: 1 },
    })

    const byStage = await request(app).get('/api/me/received-requests?stage=new').set(headers)
    expect(byStage.body.data.map((item: { id: string }) => item.id)).toEqual(['SOL-ORG-A1'])

    const byPet = await request(app).get('/api/me/received-requests?petId=pet-org-a').set(headers)
    expect(byPet.body).toMatchObject({
      total: 2,
      counters: { all: 2, new: 1, 'interview-done': 1, closed: 0 },
    })

    const byPetAndStage = await request(app)
      .get('/api/me/received-requests?petId=pet-org-a&stage=interview-done')
      .set(headers)
    expect(byPetAndStage.body.data.map((item: { id: string }) => item.id)).toEqual(['SOL-ORG-A2'])
  })

  it('[ORGQ-02] petId de outra instituição não revela solicitações', async () => {
    const { headers } = await makeGuardian('org-org-02')
    await makeAdopter('adopter-org-02')
    await makePet('pet-org-02-other', { organization: 'Outra Instituição' })
    await makeRequest('SOL-ORG-OTHER', 'pet-org-02-other', 'adopter-org-02', 'Enviada')

    const response = await request(app)
      .get('/api/me/received-requests?petId=pet-org-02-other')
      .set(headers)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ total: 0, data: [] })
  })

  it('[AGD-LEGADO-01] Zod bloqueia horário passado e tipo inválido no backend', async () => {
    const { headers } = await makeGuardian('org-agd-01')
    await makeAdopter('adopter-agd-01')
    await makePet('pet-agd-01')
    await makeRequest('SOL-AGD-01', 'pet-agd-01', 'adopter-agd-01', 'Em análise')

    const past = await request(app)
      .post('/api/me/received-requests/SOL-AGD-01/interview')
      .set(headers)
      .send({ type: 'Entrevista online', proposedSlots: ['2020-01-01T12:00:00.000Z'] })
    expect(past.status).toBe(400)
    expect(past.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'proposedSlots.0' })]),
    )

    const invalidType = await request(app)
      .post('/api/me/received-requests/SOL-AGD-01/interview')
      .set(headers)
      .send({
        type: 'Encontro improvisado',
        proposedSlots: [new Date(Date.now() + 86_400_000).toISOString()],
      })
    expect(invalidType.status).toBe(400)
    expect(invalidType.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'type' })]),
    )
  })

  it('[AGD-LEGADO-02] aceita de 1 a 3 horários futuros e rejeita 4', async () => {
    const { headers } = await makeGuardian('org-agd-02')
    await makeAdopter('adopter-agd-02')
    await makePet('pet-agd-02')
    await makeRequest('SOL-AGD-02', 'pet-agd-02', 'adopter-agd-02', 'Em análise')

    const future = (day: number) => new Date(Date.now() + day * 86_400_000).toISOString()
    const tooMany = await request(app)
      .post('/api/me/received-requests/SOL-AGD-02/interview')
      .set(headers)
      .send({
        type: 'Visita presencial',
        proposedSlots: [future(1), future(2), future(3), future(4)],
      })
    expect(tooMany.status).toBe(400)

    const valid = await request(app)
      .post('/api/me/received-requests/SOL-AGD-02/interview')
      .set(headers)
      .send({ type: 'Visita presencial', proposedSlots: [future(1), future(2)] })
    expect(valid.status).toBe(200)
    expect(valid.body.interview).toMatchObject({ status: 'AGENDADA', completed: false })
    expect(valid.body.interview.proposedSlots).toHaveLength(2)
  })

  it('[MATCH-01] o detalhe traz score calculado no servidor', async () => {
    const { headers } = await makeGuardian('org-match-01')
    await makeAdopter('adopter-match-01')
    await makePet('pet-match-01', { energy: 'Alta' })
    await makeRequest('SOL-MATCH-01', 'pet-match-01', 'adopter-match-01', 'Em análise')

    const response = await request(app).get('/api/me/received-requests/SOL-MATCH-01').set(headers)

    expect(response.status).toBe(200)
    // 4 de 7 critérios: 57% → Média.
    expect(response.body.matching).toMatchObject({ score: 57, level: 'Média' })
    expect(response.body.matching.good).toHaveLength(4)
    expect(response.body.matching.attention).toHaveLength(3)
  })
})
