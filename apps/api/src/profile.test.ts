import type { Express } from 'express'
import { readFileSync } from 'node:fs'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import type { Prisma } from './generated/prisma/client.js'
import { PROFILE_FIELDS } from './validation.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

const PROFILE = {
  name: 'Ana Souza',
  cpf: '52998224725',
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

/** Valores inválidos mas não vazios: o fallback da conta não pode disfarçar o campo. */
const INVALID_VALUES: Record<string, unknown> = {
  name: 'x',
  cpf: '00000000000',
  birthDate: '2015-01-01',
  email: 'invalido',
  phone: '123',
  zipCode: '123',
  address: 'x',
  housing: 'Invalido',
  dailyTime: 'Invalido',
  activityLevel: 'Invalido',
  experience: 'Invalido',
  preferredSpecies: 'Invalido',
  preferredSize: 'Invalido',
  hasOutdoorArea: null,
  hasChildren: null,
  hasOtherPets: null,
  acceptsSpecialCare: null,
}

async function makeUser(id: string, withProfile = true) {
  const user = await prisma.user.create({
    data: {
      id,
      name: withProfile ? PROFILE.name : id,
      email: `${id}@exemplo.com`,
      role: 'ADOTANTE',
    },
  })
  if (withProfile) {
    await prisma.adopterProfile.create({ data: { userId: id, ...PROFILE } })
  }
  const { token } = await signAccessToken(user)
  return { headers: bearer(token), userId: id }
}

databaseSuite('perfil do adotante (#18)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[PERF-01] perfil persiste no banco e sobrevive a um reinício da API', async () => {
    const { headers } = await makeUser('perf-01', false)
    const saved = await request(app)
      .put('/api/me/adopter-profile')
      .set(headers)
      .send({ ...PROFILE, cpf: '52998224725' })
    expect(saved.status).toBe(200)
    expect(saved.body.isComplete).toBe(true)

    // Uma app nova simula o reinício do processo: nada fica em memória.
    const restarted = createApp()
    const reloaded = await request(restarted).get('/api/me/adopter-profile').set(headers)
    expect(reloaded.status).toBe(200)
    expect(reloaded.body).toMatchObject({
      userId: 'perf-01',
      name: PROFILE.name,
      cpf: '52998224725',
      housing: PROFILE.housing,
      isComplete: true,
      missingFields: [],
    })
  })

  it('[PERF-02] valor fora do enum retorna 400 com o campo em details', async () => {
    const { headers, userId } = await makeUser('perf-02', false)
    const response = await request(app)
      .put('/api/me/adopter-profile')
      .set(headers)
      .send({ housing: 'Habitacao invalida' })
    expect(response.status).toBe(400)
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'housing',
          message: 'housing deve ser um de: Apartamento, Casa, Chácara ou sítio',
        }),
      ]),
    )
    expect(await prisma.adopterProfile.findUnique({ where: { userId } })).toBeNull()
  })

  it('[PERF-03] isComplete só é verdadeiro com todos os 17 campos válidos', async () => {
    const { headers, userId } = await makeUser('perf-03')
    for (const field of PROFILE_FIELDS) {
      await prisma.adopterProfile.update({
        where: { userId },
        data: { [field]: INVALID_VALUES[field] } as Prisma.AdopterProfileUncheckedUpdateInput,
      })
      const response = await request(app).get('/api/me/adopter-profile').set(headers)
      expect(response.status).toBe(200)
      expect(response.body.isComplete).toBe(false)
      expect(response.body.missingFields).toContain(field)

      await prisma.adopterProfile.update({
        where: { userId },
        data: {
          [field]: PROFILE[field as keyof typeof PROFILE],
        } as Prisma.AdopterProfileUncheckedUpdateInput,
      })
    }
  })

  it('[PERF-04] outro usuário não lê nem altera o perfil alheio', async () => {
    const attacker = await makeUser('perf-04-b', false)
    await makeUser('perf-04-a')

    const read = await request(app)
      .get('/api/me/adopter-profile')
      .set(attacker.headers)
      .set('X-Demo-User-Id', 'perf-04-a')
    expect(read.status).toBe(200)
    expect(read.body.userId).toBe('perf-04-b')
    expect(read.body.name).not.toBe(PROFILE.name)
    expect(read.body.housing).toBeUndefined()

    const write = await request(app)
      .put('/api/me/adopter-profile')
      .set(attacker.headers)
      .set('X-Demo-User-Id', 'perf-04-a')
      .send({ userId: 'perf-04-a', name: 'Atacante', housing: 'Casa' })
    expect(write.status).toBe(200)
    expect(write.body.userId).toBe('perf-04-b')

    const victim = await prisma.adopterProfile.findUnique({ where: { userId: 'perf-04-a' } })
    expect(victim?.name).toBe(PROFILE.name)
    expect(victim?.housing).toBe(PROFILE.housing)
  })

  it('[PERF-05] userId enviado no corpo é ignorado (mass assignment)', async () => {
    const { headers, userId } = await makeUser('perf-05', false)
    const response = await request(app)
      .put('/api/me/adopter-profile')
      .set(headers)
      .send({ ...PROFILE, userId: 'perf-05-vítima' })
    expect(response.status).toBe(200)
    expect(response.body.userId).toBe(userId)

    const stored = await prisma.adopterProfile.findUnique({ where: { userId } })
    expect(stored?.userId).toBe(userId)
    expect(
      await prisma.adopterProfile.findUnique({ where: { userId: 'perf-05-vítima' } }),
    ).toBeNull()
  })

  it('[PERF-06] GET e PUT sem token retornam 401', async () => {
    expect((await request(app).get('/api/me/adopter-profile')).status).toBe(401)
    expect(
      (await request(app).put('/api/me/adopter-profile').send({ housing: 'Casa' })).status,
    ).toBe(401)
  })

  it('[PERF-07] PUT parcial não apaga os demais campos', async () => {
    const { headers, userId } = await makeUser('perf-07')
    const response = await request(app)
      .put('/api/me/adopter-profile')
      .set(headers)
      .send({ housing: 'Casa' })
    expect(response.status).toBe(200)

    const stored = await prisma.adopterProfile.findUnique({ where: { userId } })
    expect(stored?.housing).toBe('Casa')
    expect(stored?.cpf).toBe('52998224725')
    expect(stored?.experience).toBe(PROFILE.experience)
    expect(stored?.preferredSize).toBe(PROFILE.preferredSize)
  })

  it('[PERF-08] o seed reproduz o perfil inicial da conta demo', async () => {
    const seedPath = new URL('../../web/mock-server/db.seed.json', import.meta.url)
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as {
      profile: Record<string, unknown> & { userId: string }
    }
    const { userId, ...fields } = seed.profile
    const user = await prisma.user.create({
      data: {
        id: String(userId),
        name: String(fields.name),
        email: String(fields.email),
        role: 'ADOTANTE',
      },
    })
    await prisma.adopterProfile.create({
      data: {
        ...(fields as Prisma.AdopterProfileUncheckedCreateInput),
        userId: String(userId),
      },
    })
    const { token } = await signAccessToken(user)

    const response = await request(app).get('/api/me/adopter-profile').set(bearer(token))
    expect(response.status).toBe(200)
    expect(response.body.isComplete).toBe(true)
    expect(response.body.missingFields).toEqual([])
    for (const field of PROFILE_FIELDS) {
      expect(response.body[field]).toEqual(fields[field])
    }
  })
})
