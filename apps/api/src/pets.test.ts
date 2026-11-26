import type { Express } from 'express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { NEW_MATCHING_PET } from './events.js'
import type { Prisma } from './generated/prisma/client.js'
import { type StorageProvider, setStorageProvider } from './storage.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

/** PNG 1x1 válido e um ELF renomeado: o conteúdo, não a extensão, decide. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)
const EXECUTABLE = Buffer.from('7f454c4602010100000000000000000002003e0001000000', 'hex')

const MATCH_CRITERIA = {
  species: 'Cachorro',
  size: ['Médio'],
  sex: 'Fêmea',
  city: 'São Paulo',
}

async function makeUser(id: string, guardian = false, coordinates?: { lat: number; lng: number }) {
  const user = await prisma.user.create({
    data: {
      id,
      name: id,
      email: `${id}@exemplo.com`,
      role: guardian ? 'GUARDIAN' : 'ADOTANTE',
      roles: guardian ? ['GUARDIAN'] : [],
      organizationRole: 'ADMIN',
      lat: coordinates?.lat ?? null,
      lng: coordinates?.lng ?? null,
    },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makeOrganization(id: string, name: string) {
  return prisma.organization.create({
    data: { id, name, initials: name.slice(0, 2).toUpperCase() },
  })
}

async function makeMembership(
  userId: string,
  organizationId: string,
  role: 'ADMIN' | 'VOLUNTEER' = 'ADMIN',
) {
  return prisma.membership.create({
    data: { id: `${userId}-${organizationId}`, userId, organizationId, role, status: 'ATIVO' },
  })
}

type PetOverride = Partial<Prisma.PetUncheckedCreateInput>

async function makePet(id: string, organizationId: string, overrides: PetOverride = {}) {
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
      image: `https://example.com/${id}.jpg`,
      gallery: [`https://example.com/${id}.jpg`],
      summary: 'Um pet muito querido',
      description: 'Um pet muito querido que procura um novo lar.',
      traits: ['Calmo'],
      energy: 'Moderada',
      space: 'Apartamento',
      children: true,
      otherPets: true,
      lat: -23.5505,
      lng: -46.6333,
      status: 'DISPONIVEL',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      organizationId,
      ...overrides,
    },
  })
}

function validPetBody(name: string) {
  return {
    name,
    species: 'Cachorro',
    breed: 'SRD',
    age: 2,
    size: 'Médio',
    sex: 'Fêmea',
    city: 'São Paulo',
    image: 'https://example.com/novo-pet.jpg',
    summary: 'Um pet muito querido',
    description: 'Um pet muito querido que procura um novo lar.',
    traits: ['Brincalhão'],
    energy: 'Moderada',
    space: 'Quintal',
    children: true,
    otherPets: false,
  }
}

async function makeFilterOwner(id: string, criteria: Record<string, unknown>) {
  await prisma.user.create({ data: { id, name: id, email: `${id}@exemplo.com` } })
  await prisma.savedFilter.create({
    data: {
      id: `${id}-filter`,
      userId: id,
      name: `Filtro ${id}`,
      criteria: criteria as unknown as Prisma.InputJsonValue,
      active: true,
      createdAt: new Date(),
    },
  })
}

const petIds = (body: { data: Array<{ id: string }> }) => body.data.map(({ id }) => id)

databaseSuite('CRUD de pets (#49)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[PET-01] filtros combinados de espécie, porte repetido, sexo e cidade', async () => {
    const admin = await makeUser('pet-01-admin', true)
    const organization = await makeOrganization('pet-01-org', 'PET 01')
    await makeMembership(admin.user.id, organization.id)

    await makePet('pet-01-a', organization.id, {
      name: 'Alfa',
      species: 'Cachorro',
      size: 'Médio',
      sex: 'Fêmea',
      city: 'São Paulo',
    })
    await makePet('pet-01-b', organization.id, {
      name: 'Bravo',
      species: 'Cachorro',
      size: 'Pequeno',
      sex: 'Fêmea',
      city: 'São Paulo',
    })
    await makePet('pet-01-c', organization.id, {
      name: 'Charlie',
      species: 'Cachorro',
      size: 'Grande',
      sex: 'Fêmea',
      city: 'São Paulo',
    })
    await makePet('pet-01-d', organization.id, {
      name: 'Delta',
      species: 'Cachorro',
      size: 'Médio',
      sex: 'Macho',
      city: 'São Paulo',
    })
    await makePet('pet-01-e', organization.id, {
      name: 'Eco',
      species: 'Cachorro',
      size: 'Médio',
      sex: 'Fêmea',
      city: 'Rio de Janeiro',
    })
    await makePet('pet-01-f', organization.id, {
      name: 'Foxinha',
      species: 'Gato',
      size: 'Médio',
      sex: 'Fêmea',
      city: 'São Paulo',
    })

    const response = await request(app)
      .get('/api/pets')
      .query({
        species: 'Cachorro',
        size: ['Pequeno', 'Médio'],
        sex: 'Fêmea',
        city: 'São Paulo',
        limit: 100,
      })

    expect(response.status).toBe(200)
    expect(response.body.total).toBe(2)
    expect(petIds(response.body).sort()).toEqual(['pet-01-a', 'pet-01-b'])
  })

  it('[PET-02] paginação com total correto, sem repetidos ou faltando', async () => {
    const organization = await makeOrganization('pet-02-org', 'PET 02')
    const ids = Array.from({ length: 7 }, (_, index) => `pet-02-${index + 1}`)
    for (const [index, id] of ids.entries()) {
      await makePet(id, organization.id, {
        name: `Nome ${String(index).padStart(2, '0')}`,
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
      })
    }

    const collected: string[] = []
    for (let page = 1; page <= 3; page += 1) {
      const response = await request(app).get('/api/pets').query({ page, limit: 3 })
      expect(response.status).toBe(200)
      expect(response.body.total).toBe(7)
      expect(response.body.data).toHaveLength(page === 3 ? 1 : 3)
      collected.push(...petIds(response.body))
    }

    expect(new Set(collected).size).toBe(7)
    expect(collected.slice().sort()).toEqual(ids.slice().sort())
  })

  it('[PET-03] sort=distance exige coordenadas e ordena por distância crescente', async () => {
    const organization = await makeOrganization('pet-03-org', 'PET 03')
    await makePet('pet-03-far', organization.id, { lat: -23.6, lng: -46.7 })
    await makePet('pet-03-mid', organization.id, { lat: -23.56, lng: -46.64 })
    await makePet('pet-03-near', organization.id, { lat: -23.5505, lng: -46.6333 })

    const missing = await request(app).get('/api/pets').query({ sort: 'distance' })
    expect(missing.status).toBe(400)
    expect(missing.body).toMatchObject({ statusCode: 400, error: 'Bad Request' })

    const response = await request(app)
      .get('/api/pets')
      .query({ sort: 'distance', lat: -23.5505, lng: -46.6333 })
    expect(response.status).toBe(200)
    expect(response.body.total).toBe(3)
    expect(petIds(response.body)).toEqual(['pet-03-near', 'pet-03-mid', 'pet-03-far'])
    const distances = response.body.data.map((pet: { distanceKm: number }) => pet.distanceKm)
    expect(distances.every((value: number) => typeof value === 'number')).toBe(true)
    expect(distances).toEqual([...distances].sort((a: number, b: number) => a - b))
  })

  it('[PET-04] listagem só traz disponíveis, mas o detalhe continua acessível', async () => {
    const organization = await makeOrganization('pet-04-org', 'PET 04')
    await makePet('pet-04-available', organization.id)
    await makePet('pet-04-adopted', organization.id, { status: 'ADOTADO' })
    await makePet('pet-04-archived', organization.id, { status: 'ARQUIVADO' })

    const list = await request(app).get('/api/pets')
    expect(list.status).toBe(200)
    expect(list.body.total).toBe(1)
    expect(petIds(list.body)).toEqual(['pet-04-available'])

    for (const [id, status] of [
      ['pet-04-adopted', 'ADOTADO'],
      ['pet-04-archived', 'ARQUIVADO'],
    ] as const) {
      const detail = await request(app).get(`/api/pets/${id}`)
      expect(detail.status).toBe(200)
      expect(detail.body.status).toBe(status)
    }
  })

  it('[PET-05] id inexistente retorna 404 no formato padrão', async () => {
    const response = await request(app).get('/api/pets/pet-inexistente')

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Pet não encontrado',
    })
  })

  it('[PET-06] sem vínculo com organização não cria, edita nem arquiva', async () => {
    const outsider = await makeUser('pet-06-outsider', true)
    await makeOrganization('pet-06-org', 'PET 06')
    const pet = await makePet('pet-06-pet', 'pet-06-org')

    const created = await request(app)
      .post('/api/pets')
      .set(outsider.headers)
      .send(validPetBody('Pet 06'))
    const edited = await request(app)
      .put(`/api/pets/${pet.id}`)
      .set(outsider.headers)
      .send({ name: 'Alterado pelo invasor' })
    const archived = await request(app).post(`/api/pets/${pet.id}/archive`).set(outsider.headers)

    expect(created.status).toBe(403)
    expect(edited.status).toBe(403)
    expect(archived.status).toBe(403)
    expect(created.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
    expect(await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).toMatchObject({
      name: `Pet ${pet.id}`,
      status: 'DISPONIVEL',
    })
    expect(await prisma.pet.count()).toBe(1)
  })

  it('[PET-07] membro da organização A não edita pet da B', async () => {
    const adminA = await makeUser('pet-07-admin-a', true)
    const adminB = await makeUser('pet-07-admin-b', true)
    const organizationA = await makeOrganization('pet-07-org-a', 'PET 07 A')
    const organizationB = await makeOrganization('pet-07-org-b', 'PET 07 B')
    await makeMembership(adminA.user.id, organizationA.id)
    await makeMembership(adminB.user.id, organizationB.id)
    const pet = await makePet('pet-07-pet', organizationB.id)

    const edited = await request(app)
      .put(`/api/pets/${pet.id}`)
      .set(adminA.headers)
      .send({ name: 'Pet sequestrado' })
    const uploaded = await request(app)
      .post(`/api/pets/${pet.id}/photos`)
      .set(adminA.headers)
      .attach('files', PNG, 'foto.png')

    expect(edited.status).toBe(403)
    expect(edited.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
    expect(uploaded.status).toBe(403)
    expect(await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).toMatchObject({
      name: `Pet ${pet.id}`,
      organizationId: organizationB.id,
    })
  })

  it('[PET-08] organizationId e status do corpo são ignorados na criação e edição', async () => {
    const admin = await makeUser('pet-08-admin', true)
    const organizationA = await makeOrganization('pet-08-org-a', 'PET 08 A')
    const organizationB = await makeOrganization('pet-08-org-b', 'PET 08 B')
    await makeMembership(admin.user.id, organizationA.id)
    await makeFilterOwner('pet-08-owner', MATCH_CRITERIA)

    const created = await request(app)
      .post('/api/pets')
      .set(admin.headers)
      .send({ ...validPetBody('Pet 08'), organizationId: organizationB.id, status: 'ADOTADO' })
    expect(created.status).toBe(201)
    const createdId = created.body.id as string
    expect(created.body.organization).toBe(organizationA.name)
    expect(await prisma.pet.findUniqueOrThrow({ where: { id: createdId } })).toMatchObject({
      organizationId: organizationA.id,
      status: 'DISPONIVEL',
    })

    // Integração #31: a publicação enfileira o alerta na mesma transação.
    const events = await prisma.eventOutbox.findMany({ where: { type: NEW_MATCHING_PET } })
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({ petId: createdId, userId: 'pet-08-owner' })

    const edited = await request(app)
      .put(`/api/pets/${createdId}`)
      .set(admin.headers)
      .send({ organizationId: organizationB.id, status: 'ADOTADO' })
    expect(edited.status).toBe(200)
    expect(await prisma.pet.findUniqueOrThrow({ where: { id: createdId } })).toMatchObject({
      organizationId: organizationA.id,
      status: 'DISPONIVEL',
    })
  })

  it('[PET-09] injeção em search, city e sort não altera a consulta', async () => {
    const organization = await makeOrganization('pet-09-org', 'PET 09')
    await makePet('pet-09-pet', organization.id)

    const city = await request(app).get('/api/pets').query({ city: "São Paulo' OR '1'='1" })
    const search = await request(app).get('/api/pets').query({ search: "' OR 1=1 --" })
    const sort = await request(app).get('/api/pets').query({ sort: 'recent; DROP TABLE pets;--' })

    expect(city.status).toBe(200)
    expect(city.body.total).toBe(0)
    expect(search.status).toBe(200)
    expect(search.body.total).toBe(0)
    expect(sort.status).toBe(400)
    expect(await prisma.pet.count()).toBe(1)
  })

  describe('upload de fotos (#49/PET-10)', () => {
    const files = new Map<string, { body: Buffer; contentType: string }>()
    const provider: StorageProvider = {
      bucket: 'pets-test',
      async ensureBucket() {},
      async putObject({ key, body, contentType }) {
        files.set(key, { body, contentType })
        return { key, contentType, sizeBytes: body.byteLength }
      },
      async getObject(key) {
        const file = files.get(key)
        if (!file) throw new Error('objeto ausente')
        return { ...file, sizeBytes: file.body.byteLength }
      },
      async deleteObject(key) {
        files.delete(key)
      },
      async objectExists(key) {
        return files.has(key)
      },
      async presignGet() {
        return 'http://storage.test/objeto'
      },
    }
    let previousEnv: Record<string, string | undefined>

    beforeAll(() => {
      previousEnv = {
        STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
        STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
        STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
      }
      process.env.STORAGE_ENDPOINT = 'http://storage.test'
      process.env.STORAGE_ACCESS_KEY_ID = 'teste'
      process.env.STORAGE_SECRET_ACCESS_KEY = 'teste'
      setStorageProvider(provider)
    })

    afterAll(() => {
      setStorageProvider(null)
      files.clear()
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    const uploadPhotos = (
      app: Express,
      headers: Record<string, string>,
      petId: string,
      attachments: Array<[Buffer, string]>,
    ) => {
      let call = request(app).post(`/api/pets/${petId}/photos`).set(headers)
      for (const [body, name] of attachments) call = call.attach('files', body, name)
      return call
    }

    it('[PET-10] foto validada por conteúdo, tamanho e quantidade', async () => {
      const admin = await makeUser('pet-10-admin', true)
      const organization = await makeOrganization('pet-10-org', 'PET 10')
      await makeMembership(admin.user.id, organization.id)
      const pet = await makePet('pet-10-pet', organization.id)

      const executable = await uploadPhotos(app, admin.headers, pet.id, [[EXECUTABLE, 'foto.png']])
      expect(executable.status).toBe(400)

      const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)])
      const oversized = await uploadPhotos(app, admin.headers, pet.id, [[big, 'grande.png']])
      expect(oversized.status).toBe(400)

      const many = await uploadPhotos(
        app,
        admin.headers,
        pet.id,
        Array.from({ length: 9 }, () => [PNG, 'foto.png'] as [Buffer, string]),
      )
      expect(many.status).toBe(400)

      const valid = await uploadPhotos(app, admin.headers, pet.id, [
        [PNG, 'um.png'],
        [PNG, 'dois.png'],
      ])
      expect(valid.status).toBe(201)
      const persisted = await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })
      expect(persisted.gallery).toHaveLength(3)
      expect(persisted.image).not.toBe(pet.image)
      expect(
        await prisma.storageObject.count({ where: { resourceType: 'PET', resourceId: pet.id } }),
      ).toBe(2)
    })
  })

  it('[PET-11] arquivar preserva solicitações e reabrir dispara alerta', async () => {
    const admin = await makeUser('pet-11-admin', true)
    const adopter = await makeUser('pet-11-adopter')
    const organization = await makeOrganization('pet-11-org', 'PET 11')
    await makeMembership(admin.user.id, organization.id)
    const pet = await makePet('pet-11-pet', organization.id)
    await makeFilterOwner('pet-11-owner', MATCH_CRITERIA)

    const adoptionRequest = await prisma.adoptionRequest.create({
      data: {
        id: 'pet-11-request',
        userId: adopter.user.id,
        petId: pet.id,
        status: 'ENVIADA',
        date: new Date(),
        message: 'Gostaria de adotar',
      },
    })
    await prisma.adoption.create({
      data: {
        id: 'pet-11-adoption',
        requestId: adoptionRequest.id,
        petId: pet.id,
        adopterId: adopter.user.id,
        organizationId: organization.id,
        adoptedAt: new Date(),
      },
    })

    const archived = await request(app).post(`/api/pets/${pet.id}/archive`).set(admin.headers)
    expect(archived.status).toBe(200)
    expect(archived.body.status).toBe('ARQUIVADO')
    const detail = await request(app).get(`/api/pets/${pet.id}`)
    expect(detail.body.status).toBe('ARQUIVADO')
    expect(
      await prisma.adoptionRequest.findUnique({ where: { id: adoptionRequest.id } }),
    ).not.toBeNull()
    expect(await prisma.adoption.findUnique({ where: { id: 'pet-11-adoption' } })).not.toBeNull()
    expect(await prisma.eventOutbox.count({ where: { type: NEW_MATCHING_PET } })).toBe(0)

    const reopened = await request(app)
      .put(`/api/pets/${pet.id}`)
      .set(admin.headers)
      .send({ status: 'DISPONIVEL' })
    expect(reopened.status).toBe(200)
    expect(reopened.body.status).toBe('DISPONIVEL')
    const events = await prisma.eventOutbox.findMany({ where: { type: NEW_MATCHING_PET } })
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({ petId: pet.id, userId: 'pet-11-owner' })
  })

  it('[PET-12] reordenar galeria e trocar capa reflete no detalhe', async () => {
    const admin = await makeUser('pet-12-admin', true)
    const organization = await makeOrganization('pet-12-org', 'PET 12')
    await makeMembership(admin.user.id, organization.id)
    const first = 'https://example.com/a.jpg'
    const second = 'https://example.com/b.jpg'
    const third = 'https://example.com/c.jpg'
    const pet = await makePet('pet-12-pet', organization.id, {
      image: first,
      gallery: [first, second, third],
    })

    const reordered = await request(app)
      .put(`/api/pets/${pet.id}/gallery`)
      .set(admin.headers)
      .send({ gallery: [third, first, second], image: third })
    expect(reordered.status).toBe(200)

    const detail = await request(app).get(`/api/pets/${pet.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.gallery).toEqual([third, first, second])
    expect(detail.body.image).toBe(third)

    const invalidCover = await request(app)
      .put(`/api/pets/${pet.id}/gallery`)
      .set(admin.headers)
      .send({ gallery: [first, second], image: 'https://example.com/fora.jpg' })
    expect(invalidCover.status).toBe(400)
  })
})
