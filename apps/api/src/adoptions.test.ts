import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { completeFollowUpPlanIfReviewed, generateFollowUpDueDates } from './adoptions.js'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'

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

async function makeUser(
  id: string,
  options: { organizationName?: string; guardian?: boolean } = {},
) {
  const user = await prisma.user.create({
    data: {
      id,
      name: id,
      email: `${id}@exemplo.com`,
      role: options.guardian ? 'GUARDIAN' : 'ADOTANTE',
      roles: options.guardian ? ['GUARDIAN'] : ['ADOTANTE'],
      organizationName: options.organizationName,
    },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makeCompleteAdopterProfile(userId: string) {
  await prisma.adopterProfile.create({
    data: {
      userId,
      name: 'Pessoa Adotante',
      cpf: '52998224725',
      birthDate: '1990-01-01',
      email: `${userId}@exemplo.com`,
      phone: '11987654321',
      zipCode: '01001000',
      address: 'Rua dos Testes, 123',
      housing: 'Apartamento',
      hasOutdoorArea: false,
      dailyTime: '2 a 3 horas',
      activityLevel: 'Moderado',
      hasChildren: false,
      hasOtherPets: false,
      experience: 'Já tive pets',
      acceptsSpecialCare: false,
      preferredSpecies: 'Sem preferência',
      preferredSize: 'Sem preferência',
    },
  })
}

async function makeOrganization(name: string) {
  return prisma.organization.create({
    data: { name, initials: name.slice(0, 2).toUpperCase() },
  })
}

async function addMembership(
  userId: string,
  organizationId: string,
  role: 'ADMIN' | 'VOLUNTEER' = 'ADMIN',
) {
  return prisma.membership.create({
    data: { userId, organizationId, role, status: 'ATIVO' },
  })
}

async function makePet(id: string, organization: string, status = 'DISPONIVEL') {
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
      organization,
      organizationInitials: organization.slice(0, 2).toUpperCase(),
      createdAt: new Date(),
      status,
    },
  })
}

async function makeRequest(id: string, userId: string, petId: string) {
  return prisma.adoptionRequest.create({
    data: {
      id,
      userId,
      petId,
      status: 'ANALISE_QUESTIONARIO',
      date: new Date(),
      message: 'Solicitação em análise',
      answers: QUESTIONNAIRE,
      interview: { completed: true, status: 'REALIZADA' },
    },
  })
}

async function makeAdoption(id: string, organizationId: string, petOrganization: string) {
  const adopter = await makeUser(`${id}-adopter`)
  const organizationAdmin = await makeUser(`${id}-admin`, {
    guardian: true,
    organizationName: petOrganization,
  })
  await addMembership(organizationAdmin.user.id, organizationId)
  const pet = await makePet(`${id}-pet`, petOrganization)
  const adoptionRequest = await makeRequest(`${id}-request`, adopter.user.id, pet.id)
  return prisma.adoption
    .create({
      data: {
        requestId: adoptionRequest.id,
        petId: pet.id,
        adopterId: adopter.user.id,
        organizationId,
      },
    })
    .then((adoption) => ({ adoption, adopter, organizationAdmin }))
}

function createApprovalRequest(app: Express, requestId: string, headers: Record<string, string>) {
  return request(app)
    .post(`/api/me/received-requests/${requestId}/transitions`)
    .set(headers)
    .send({ to: 'APROVADA' })
}

describe('datas do plano de acompanhamento (#23)', () => {
  it('[ADOC-03] gera datas para o intervalo-limite e duração não múltipla', () => {
    const adoptedAt = new Date('2026-01-01T18:45:00.000Z')
    const singleInterval = generateFollowUpDueDates(adoptedAt, 15, 15)
    const nonMultiple = generateFollowUpDueDates(adoptedAt, 100, 30)

    expect(singleInterval.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-01-16'])
    expect(nonMultiple.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-03-02',
      '2026-04-01',
    ])
    expect(() => generateFollowUpDueDates(adoptedAt, 3651, 1)).toThrow(RangeError)
  })
})

databaseSuite('adoções e planos de acompanhamento (#23)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(resetTestDatabase)

  it('[ADOC-01] aprovar cria exatamente uma adoção e adota o pet', async () => {
    const organization = await makeOrganization('Instituto ADOC-01')
    const adopter = await makeUser('adoc-01-adopter')
    const admin = await makeUser('adoc-01-admin', {
      guardian: true,
      organizationName: organization.name,
    })
    await addMembership(admin.user.id, organization.id)
    const pet = await makePet('adoc-01-pet', organization.name)
    const adoptionRequest = await makeRequest('adoc-01-request', adopter.user.id, pet.id)

    const first = await createApprovalRequest(app, adoptionRequest.id, admin.headers)
    const repeated = await createApprovalRequest(app, adoptionRequest.id, admin.headers)

    expect(first.status).toBe(200)
    expect(repeated.status).toBe(409)
    expect(await prisma.adoption.count({ where: { requestId: adoptionRequest.id } })).toBe(1)
    expect((await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).status).toBe('ADOTADO')
  })

  it('[ADOC-02] pet adotado não aparece na listagem nem no matching', async () => {
    const organization = await makeOrganization('Instituto ADOC-02')
    const adopted = await makePet('adoc-02-adopted', organization.name, 'ADOTADO')
    const available = await makePet('adoc-02-available', organization.name)
    const adopter = await makeUser('adoc-02-adopter')
    await makeCompleteAdopterProfile(adopter.user.id)

    const [response, matches] = await Promise.all([
      request(app).get('/api/pets'),
      request(app).get('/api/me/matches').set(adopter.headers),
    ])

    expect(response.status).toBe(200)
    expect(response.body.data.map((pet: { id: string }) => pet.id)).not.toContain(adopted.id)
    expect(matches.status).toBe(200)
    expect(matches.body.data.map((pet: { id: string }) => pet.id)).not.toContain(adopted.id)
    expect(matches.body.data.map((pet: { id: string }) => pet.id)).toContain(available.id)
  })

  it('[ADOC-04] somente membro da organização cria ou edita o plano', async () => {
    const organization = await makeOrganization('Instituto ADOC-04')
    const { adoption, adopter, organizationAdmin } = await makeAdoption(
      'adoc-04',
      organization.id,
      organization.name,
    )
    const body = { durationDays: 30, intervalDays: 15 }

    const adopterPlan = await request(app)
      .post(`/api/adoptions/${adoption.id}/follow-up-plan`)
      .set(adopter.headers)
      .send(body)
    expect(adopterPlan.status).toBe(403)

    const created = await request(app)
      .post(`/api/adoptions/${adoption.id}/follow-up-plan`)
      .set(organizationAdmin.headers)
      .send(body)
    expect(created.status).toBe(201)
    expect(created.body.checkIns).toHaveLength(2)

    const edited = await request(app)
      .put(`/api/adoptions/${adoption.id}/follow-up-plan`)
      .set(organizationAdmin.headers)
      .send({ durationDays: 45, intervalDays: 15 })
    expect(edited.status).toBe(200)
    expect(edited.body.checkIns).toHaveLength(3)
  })

  it('[ADOC-05] editar o plano preserva check-ins já enviados', async () => {
    const organization = await makeOrganization('Instituto ADOC-05')
    const { adoption, organizationAdmin } = await makeAdoption(
      'adoc-05',
      organization.id,
      organization.name,
    )
    const dueDates = generateFollowUpDueDates(adoption.adoptedAt, 30, 15)
    await prisma.followUpPlan.create({
      data: {
        adoptionId: adoption.id,
        durationDays: 30,
        intervalDays: 15,
        createdBy: organizationAdmin.user.id,
      },
    })
    const submitted = await prisma.checkIn.create({
      data: {
        adoptionId: adoption.id,
        dueDate: dueDates[0],
        status: 'ENVIADO',
        submittedAt: new Date(),
        report: 'O pet está se adaptando bem.',
      },
    })
    await prisma.checkIn.create({
      data: { adoptionId: adoption.id, dueDate: dueDates[1] },
    })

    const response = await request(app)
      .put(`/api/adoptions/${adoption.id}/follow-up-plan`)
      .set(organizationAdmin.headers)
      .send({ durationDays: 60, intervalDays: 30 })
    const retained = await prisma.checkIn.findUniqueOrThrow({ where: { id: submitted.id } })

    expect(response.status).toBe(200)
    expect(retained.status).toBe('ENVIADO')
    expect(retained.report).toBe('O pet está se adaptando bem.')
    expect(await prisma.checkIn.count({ where: { adoptionId: adoption.id } })).toBe(3)
  })

  it('[ADOC-06] acompanhamento termina quando o último check-in é revisado', async () => {
    const organization = await makeOrganization('Instituto ADOC-06')
    const { adoption, organizationAdmin } = await makeAdoption(
      'adoc-06',
      organization.id,
      organization.name,
    )
    const plan = await prisma.followUpPlan.create({
      data: {
        adoptionId: adoption.id,
        durationDays: 30,
        intervalDays: 15,
        createdBy: organizationAdmin.user.id,
      },
    })
    const [first, last] = await Promise.all([
      prisma.checkIn.create({
        data: { adoptionId: adoption.id, dueDate: new Date(), status: 'REVISADO' },
      }),
      prisma.checkIn.create({
        data: { adoptionId: adoption.id, dueDate: new Date(), status: 'PENDENTE' },
      }),
    ])

    await prisma.$transaction((tx) => completeFollowUpPlanIfReviewed(tx, adoption.id))
    expect(
      (await prisma.followUpPlan.findUniqueOrThrow({ where: { id: plan.id } })).completedAt,
    ).toBe(null)

    await prisma.checkIn.update({
      where: { id: last.id },
      data: { status: 'REVISADO', reviewedAt: new Date() },
    })
    await prisma.$transaction((tx) => completeFollowUpPlanIfReviewed(tx, adoption.id))

    expect(
      (await prisma.followUpPlan.findUniqueOrThrow({ where: { id: plan.id } })).completedAt,
    ).not.toBeNull()
    expect(first.status).toBe('REVISADO')
  })

  it('[ADOC-07] listas de adoções respeitam adotante e organização', async () => {
    const organizationA = await makeOrganization('Instituto ADOC-07-A')
    const organizationB = await makeOrganization('Instituto ADOC-07-B')
    const first = await makeAdoption('adoc-07-a', organizationA.id, organizationA.name)
    await makeAdoption('adoc-07-b', organizationB.id, organizationB.name)

    const adopterList = await request(app).get('/api/me/adoptions').set(first.adopter.headers)
    const organizationList = await request(app)
      .get(`/api/organizations/${organizationA.id}/adoptions`)
      .set(first.organizationAdmin.headers)
    const deniedList = await request(app)
      .get(`/api/organizations/${organizationB.id}/adoptions`)
      .set(first.organizationAdmin.headers)

    expect(adopterList.body.data).toHaveLength(1)
    expect(adopterList.body.data[0].id).toBe(first.adoption.id)
    expect(organizationList.body.data).toHaveLength(1)
    expect(organizationList.body.data[0].organizationId).toBe(organizationA.id)
    expect(deniedList.status).toBe(403)
  })

  it('[ADOC-08] aprovação simultânea e falha no meio preservam atomicidade', async () => {
    const organization = await makeOrganization('Instituto ADOC-08')
    const adopter = await makeUser('adoc-08-adopter')
    const admin = await makeUser('adoc-08-admin', {
      guardian: true,
      organizationName: organization.name,
    })
    await addMembership(admin.user.id, organization.id)
    const pet = await makePet('adoc-08-pet', organization.name)
    const adoptionRequest = await makeRequest('adoc-08-request', adopter.user.id, pet.id)

    const responses = await Promise.all([
      createApprovalRequest(app, adoptionRequest.id, admin.headers),
      createApprovalRequest(app, adoptionRequest.id, admin.headers),
    ])

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409])
    expect(await prisma.adoption.count({ where: { requestId: adoptionRequest.id } })).toBe(1)
    expect((await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).status).toBe('ADOTADO')

    const rollbackPet = await makePet('adoc-08-rollback-pet', organization.name)
    const existingAdopter = await makeUser('adoc-08-existing-adopter')
    const existingRequest = await makeRequest(
      'adoc-08-existing-request',
      existingAdopter.user.id,
      rollbackPet.id,
    )
    await prisma.adoptionRequest.update({
      where: { id: existingRequest.id },
      data: { status: 'Aprovada' },
    })
    await prisma.adoption.create({
      data: {
        requestId: existingRequest.id,
        petId: rollbackPet.id,
        adopterId: existingAdopter.user.id,
        organizationId: organization.id,
      },
    })
    const secondAdopter = await makeUser('adoc-08-second-adopter')
    const secondRequest = await makeRequest(
      'adoc-08-second-request',
      secondAdopter.user.id,
      rollbackPet.id,
    )

    const failed = await createApprovalRequest(app, secondRequest.id, admin.headers)

    expect(failed.status).toBe(409)
    expect(
      (await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: secondRequest.id } })).status,
    ).toBe('ANALISE_QUESTIONARIO')
    expect((await prisma.pet.findUniqueOrThrow({ where: { id: rollbackPet.id } })).status).toBe(
      'DISPONIVEL',
    )
    expect(await prisma.adoption.count({ where: { petId: rollbackPet.id } })).toBe(1)
  })
})
