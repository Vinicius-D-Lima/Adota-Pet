import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { derivePetHealth } from './medicalRecords.js'
import { medicalRecordDataFromLegacyPet } from './medicalSeed.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const future = () => new Date(Date.now() + 86_400_000).toISOString()
const past = () => new Date(Date.now() - 86_400_000).toISOString()

async function makeUser(id: string) {
  const user = await prisma.user.create({
    data: { id, name: `Usuário ${id}`, email: `${id}@exemplo.com`, role: 'ADOTANTE' },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makeOrganization(adminId: string, suffix: string) {
  const organization = await prisma.organization.create({
    data: { name: `Organização ${suffix}`, initials: suffix.slice(0, 3).toUpperCase() },
  })
  await prisma.membership.create({
    data: { userId: adminId, organizationId: organization.id, role: 'ADMIN', status: 'ATIVO' },
  })
  return organization
}

async function makePet(id: string, organizationId: string) {
  const pet = await prisma.pet.create({
    data: {
      id,
      name: `Pet ${id}`,
      species: 'Cachorro',
      breed: 'SRD',
      age: 2,
      ageLabel: '2 anos',
      size: 'Médio',
      sex: 'Fêmea',
      city: 'São Paulo, SP',
      image: 'https://example.com/pet.jpg',
      summary: 'Um pet muito querido',
      description: 'Um pet muito querido que procura um novo lar.',
      traits: ['Calmo'],
      energy: 'Moderada',
      space: 'Apartamento',
      children: true,
      otherPets: true,
      organizationId,
      createdAt: new Date(),
    },
  })
  const record = await prisma.medicalRecord.create({
    data: {
      petId: pet.id,
      createdById: 'SYSTEM',
      updatedById: 'SYSTEM',
      neutering: {
        create: { done: false, createdById: 'SYSTEM', updatedById: 'SYSTEM' },
      },
    },
  })
  return { pet, record }
}

const vaccineBody = (nextDoseAt: string | null = future()) => ({
  name: 'V10',
  appliedAt: new Date().toISOString(),
  nextDoseAt,
  batch: 'LOTE-01',
  veterinarian: 'Dra. Ana',
})

databaseSuite('prontuário médico do pet (#29)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(resetTestDatabase)

  it('[PRO-01] vaccinated, neutered e specialCare são derivados do prontuário', async () => {
    const admin = await makeUser('pro-01-admin')
    const organization = await makeOrganization(admin.user.id, 'pro-01')
    const { pet } = await makePet('pro-01-pet', organization.id)

    expect(
      (
        await request(app)
          .post(`/api/pets/${pet.id}/medical-record/vaccinations`)
          .set(admin.headers)
          .send(vaccineBody())
      ).status,
    ).toBe(201)
    expect(
      (
        await request(app)
          .put(`/api/pets/${pet.id}/medical-record/neutering`)
          .set(admin.headers)
          .send({ done: true, date: new Date().toISOString() })
      ).status,
    ).toBe(200)
    expect(
      (
        await request(app)
          .post(`/api/pets/${pet.id}/medical-record/conditions`)
          .set(admin.headers)
          .send({
            name: 'Cardiopatia',
            type: 'CRONICA',
            notes: 'Acompanhamento',
            careRequired: true,
          })
      ).status,
    ).toBe(201)

    const response = await request(app).get(`/api/pets/${pet.id}`)
    expect(response.body).toMatchObject({ vaccinated: true, neutered: true, specialCare: true })
  })

  it('[PRO-02] vacina com próxima dose vencida torna vaccinated falso', async () => {
    const admin = await makeUser('pro-02-admin')
    const organization = await makeOrganization(admin.user.id, 'pro-02')
    const { pet } = await makePet('pro-02-pet', organization.id)
    await request(app)
      .post(`/api/pets/${pet.id}/medical-record/vaccinations`)
      .set(admin.headers)
      .send(vaccineBody(past()))

    const response = await request(app).get(`/api/pets/${pet.id}`)
    expect(response.body.vaccinated).toBe(false)
  })

  it('[PRO-03] campos derivados enviados no cadastro do pet são ignorados', async () => {
    const admin = await makeUser('pro-03-admin')
    await makeOrganization(admin.user.id, 'pro-03')
    const response = await request(app)
      .post('/api/me/organization-pets')
      .set(admin.headers)
      .send({
        name: 'Mel',
        species: 'Cachorro',
        breed: 'SRD',
        age: 2,
        size: 'Médio',
        sex: 'Fêmea',
        city: 'São Paulo, SP',
        image: 'https://example.com/mel.jpg',
        summary: 'Carinhosa e tranquila',
        description: 'Uma cachorrinha carinhosa que procura uma família responsável.',
        traits: ['Carinhosa'],
        energy: 'Média',
        space: 'Apartamento',
        children: true,
        otherPets: true,
        vaccinated: true,
        neutered: true,
        specialCare: true,
      })
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ vaccinated: false, neutered: false, specialCare: false })
  })

  it('[PRO-04] visão pública não expõe anexos, exames nem observações', async () => {
    const admin = await makeUser('pro-04-admin')
    const adopter = await makeUser('pro-04-adopter')
    const organization = await makeOrganization(admin.user.id, 'pro-04')
    const { pet, record } = await makePet('pro-04-pet', organization.id)
    await prisma.healthCondition.create({
      data: {
        medicalRecordId: record.id,
        name: 'Alergia',
        type: 'EM_TRATAMENTO',
        notes: 'Observação clínica privada',
        careRequired: true,
        createdById: admin.user.id,
        updatedById: admin.user.id,
      },
    })
    await prisma.exam.create({
      data: {
        id: 'pro-04-exam',
        medicalRecordId: record.id,
        type: 'Hemograma',
        date: new Date(),
        result: 'Resultado interno',
        createdById: admin.user.id,
        updatedById: admin.user.id,
      },
    })
    await prisma.adoptionRequest.create({
      data: {
        id: 'PRO-04-REQ',
        userId: adopter.user.id,
        petId: pet.id,
        status: 'ENVIADA',
        date: new Date(),
        message: 'Solicitação ativa',
      },
    })

    const publicView = await request(app).get(`/api/pets/${pet.id}/medical-record`)
    expect(publicView.status).toBe(200)
    expect(publicView.body).not.toHaveProperty('exams')
    expect(publicView.body.healthConditions[0]).not.toHaveProperty('notes')

    const fullView = await request(app)
      .get(`/api/pets/${pet.id}/medical-record`)
      .set(adopter.headers)
    expect(fullView.body.complete).toBe(true)
    expect(fullView.body.healthConditions[0].notes).toBe('Observação clínica privada')
    expect(fullView.body.exams[0].result).toBe('Resultado interno')
  })

  it('[PRO-05] somente membros da organização do pet editam o prontuário', async () => {
    const admin = await makeUser('pro-05-admin')
    const outsider = await makeUser('pro-05-outsider')
    const organization = await makeOrganization(admin.user.id, 'pro-05')
    const { pet } = await makePet('pro-05-pet', organization.id)

    expect(
      (
        await request(app)
          .post(`/api/pets/${pet.id}/medical-record/vaccinations`)
          .set(outsider.headers)
          .send(vaccineBody())
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .post(`/api/pets/${pet.id}/medical-record/vaccinations`)
          .set(admin.headers)
          .send(vaccineBody())
      ).status,
    ).toBe(201)
  })

  it('[PRO-06] anexos de exames só são liberados por URL assinada a usuários vinculados', async () => {
    const admin = await makeUser('pro-06-admin')
    const adopter = await makeUser('pro-06-adopter')
    const outsider = await makeUser('pro-06-outsider')
    const organization = await makeOrganization(admin.user.id, 'pro-06')
    const { pet, record } = await makePet('pro-06-pet', organization.id)
    const exam = await prisma.exam.create({
      data: {
        id: 'pro-06-exam',
        medicalRecordId: record.id,
        type: 'Raio-X',
        date: new Date(),
        result: 'Sem alterações',
        createdById: admin.user.id,
        updatedById: admin.user.id,
      },
    })
    const object = await prisma.storageObject.create({
      data: {
        key: 'medical-exams/pro-06.pdf',
        contentType: 'application/pdf',
        sizeBytes: 100,
        resourceType: 'MEDICAL_EXAM',
        resourceId: exam.id,
        ownerId: admin.user.id,
      },
    })
    await prisma.exam.update({ where: { id: exam.id }, data: { attachment: object.id } })
    await prisma.adoptionRequest.create({
      data: {
        id: 'PRO-06-REQ',
        userId: adopter.user.id,
        petId: pet.id,
        status: 'ENVIADA',
        date: new Date(),
        message: 'Solicitação ativa',
      },
    })

    expect(
      (await request(app).post(`/api/storage/objects/${object.id}/url`).set(outsider.headers))
        .status,
    ).toBe(403)
    const signed = await request(app)
      .post(`/api/storage/objects/${object.id}/url`)
      .set(adopter.headers)
    expect(signed.status).toBe(200)
    expect(signed.body.url).toMatch(new RegExp(`^/files/${object.id}\\?token=`))
  })

  it('[PRO-07] criação e alteração registram usuário e data na auditoria', async () => {
    const creator = await makeUser('pro-07-creator')
    const editor = await makeUser('pro-07-editor')
    const organization = await makeOrganization(creator.user.id, 'pro-07')
    await prisma.membership.create({
      data: {
        userId: editor.user.id,
        organizationId: organization.id,
        role: 'VOLUNTEER',
        status: 'ATIVO',
      },
    })
    const { pet } = await makePet('pro-07-pet', organization.id)
    const created = await request(app)
      .post(`/api/pets/${pet.id}/medical-record/vaccinations`)
      .set(creator.headers)
      .send(vaccineBody())
    const updated = await request(app)
      .put(`/api/pets/${pet.id}/medical-record/vaccinations/${created.body.id}`)
      .set(editor.headers)
      .send({ ...vaccineBody(), batch: 'LOTE-02' })

    expect(updated.status).toBe(200)
    expect(updated.body.createdById).toBe(creator.user.id)
    expect(updated.body.updatedById).toBe(editor.user.id)
    expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(updated.body.createdAt).getTime(),
    )
  })

  it('[PRO-08] conversão do seed preserva os booleanos atuais de todos os pets', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const seedPath = path.resolve(here, '../../web/mock-server/db.seed.json')
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as {
      pets: Array<{
        id: string
        createdAt: string
        vaccinated: boolean
        neutered: boolean
        specialCare: boolean
      }>
    }
    for (const pet of seed.pets) {
      const record = medicalRecordDataFromLegacyPet(pet)
      expect(derivePetHealth(record)).toEqual({
        vaccinated: pet.vaccinated,
        neutered: pet.neutered,
        specialCare: pet.specialCare,
      })
    }
  })

  it('[PRO-09] itens de outro pet não podem ser acessados trocando os ids da URL', async () => {
    const admin = await makeUser('pro-09-admin')
    const organization = await makeOrganization(admin.user.id, 'pro-09')
    const first = await makePet('pro-09-a', organization.id)
    const second = await makePet('pro-09-b', organization.id)
    const vaccination = await prisma.vaccination.create({
      data: {
        medicalRecordId: second.record.id,
        ...vaccineBody(),
        appliedAt: new Date(),
        nextDoseAt: new Date(future()),
        createdById: admin.user.id,
        updatedById: admin.user.id,
      },
    })
    const exam = await prisma.exam.create({
      data: {
        medicalRecordId: second.record.id,
        type: 'Ultrassom',
        date: new Date(),
        result: 'Normal',
        createdById: admin.user.id,
        updatedById: admin.user.id,
      },
    })

    expect(
      (
        await request(app)
          .put(`/api/pets/${first.pet.id}/medical-record/vaccinations/${vaccination.id}`)
          .set(admin.headers)
          .send(vaccineBody())
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .put(`/api/pets/${first.pet.id}/medical-record/exams/${exam.id}`)
          .set(admin.headers)
          .send({ type: 'Ultrassom', date: new Date().toISOString(), result: 'Alterado' })
      ).status,
    ).toBe(404)
  })
})
