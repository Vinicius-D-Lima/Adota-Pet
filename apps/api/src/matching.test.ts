import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { ensureTestOrganization } from '../test/organization.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { createMatchingStrategy, matchingLevelForScore, type MatchingStrategy } from './matching.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const ORGANIZATION = 'Instituição Matching'

const ADOPTER = {
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
  preferredSpecies: 'Sem preferência',
  preferredSize: 'Sem preferência',
} as const

async function makeAdopter(id: string, withProfile = true) {
  const user = await prisma.user.create({
    data: {
      id,
      name: ADOPTER.name,
      email: `${id}@exemplo.com`,
      role: 'ADOTANTE',
      platformRole: 'USUARIO',
    },
  })
  if (withProfile) {
    await prisma.adopterProfile.create({ data: { userId: id, ...ADOPTER } })
  }
  const { token } = await signAccessToken(user)
  return { headers: bearer(token), userId: id }
}

async function makePet(
  id: string,
  overrides: Partial<{
    species: string
    size: string
    energy: string
    status: string
  }> = {},
) {
  const organization = await ensureTestOrganization(ORGANIZATION, 'IM')
  return prisma.pet.create({
    data: {
      id,
      name: `Pet ${id}`,
      species: overrides.species ?? 'Cachorro',
      breed: 'SRD',
      age: 2,
      ageLabel: '2 anos',
      size: overrides.size ?? 'Médio',
      sex: 'Fêmea',
      city: 'São Paulo',
      image: 'https://example.com/pet.jpg',
      summary: 'Um pet muito querido',
      description: 'Um pet muito querido que procura um novo lar.',
      traits: ['Calmo'],
      energy: overrides.energy ?? 'Moderada',
      space: 'Apartamento',
      children: true,
      otherPets: true,
      organizationId: organization.id,
      createdAt: new Date(),
      status: overrides.status ?? 'DISPONIVEL',
    },
  })
}

databaseSuite('matching e ranking na API (#19)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[MATCH-01] o ranking reproduz o cálculo atual do frontend', async () => {
    const { headers } = await makeAdopter('match-01')
    await makePet('match-01-pet', { energy: 'Alta' })

    const response = await request(app).get('/api/me/matches').set(headers)
    expect(response.status).toBe(200)
    const fromApi = response.body.data[0].matching
    // Mesmo resultado de `calculateCompatibility` do frontend para este par
    // pet/adotante: 4 de 7 critérios ok → 57% → Média.
    expect(fromApi).toMatchObject({ score: 57, level: 'Média' })
    expect(fromApi.good).toHaveLength(4)
    expect(fromApi.attention).toHaveLength(3)
  })

  it('[MATCH-02] energia alta com até 1 hora vira ponto de atenção', async () => {
    const { headers } = await makeAdopter('match-02')
    await makePet('match-02-pet', { energy: 'Alta' })

    const response = await request(app).get('/api/me/matches').set(headers)
    expect(response.status).toBe(200)
    const attention = response.body.data[0].matching.attention as Array<{ attention: string }>
    expect(attention.map((item) => item.attention)).toEqual(
      expect.arrayContaining([expect.stringContaining('energia alta')]),
    )
  })

  it('[MATCH-03] níveis usam os limites 80/55 (e 79/54 ficam abaixo)', () => {
    expect(matchingLevelForScore(100)).toBe('Alta')
    expect(matchingLevelForScore(80)).toBe('Alta')
    expect(matchingLevelForScore(79)).toBe('Média')
    expect(matchingLevelForScore(55)).toBe('Média')
    expect(matchingLevelForScore(54)).toBe('Baixa')

    const tuned = createMatchingStrategy({
      weights: { energy: 0 },
      thresholds: { high: 90, medium: 40 },
    })
    const tunedResult = tuned.calculate(
      {
        name: 'Pet',
        energy: 'Alta',
        space: 'Casa',
        children: false,
        otherPets: false,
        specialCare: false,
      },
      {
        ...ADOPTER,
        activityLevel: 'Tranquilo',
        dailyTime: 'Até 1 hora',
        experience: 'Primeiro pet',
      },
    )
    expect(tunedResult?.score).toBe(67)
    expect(tunedResult?.level).toBe('Média')
  })

  it('[MATCH-04] filtra species/size e ordena do maior para o menor score', async () => {
    const { headers } = await makeAdopter('match-04')
    await makePet('match-04-high', { energy: 'Moderada', species: 'Cachorro', size: 'Médio' })
    await makePet('match-04-low', { energy: 'Alta', species: 'Cachorro', size: 'Médio' })
    await makePet('match-04-cat', { species: 'Gato', size: 'Médio' })
    await makePet('match-04-small', { species: 'Cachorro', size: 'Pequeno' })

    const response = await request(app)
      .get('/api/me/matches?species=Cachorro&size=Médio')
      .set(headers)
    expect(response.status).toBe(200)
    expect(response.body.data.map((pet: { id: string }) => pet.id)).toEqual([
      'match-04-high',
      'match-04-low',
    ])
    const scores = response.body.data.map(
      (pet: { matching: { score: number } }) => pet.matching.score,
    )
    expect(scores[0]).toBeGreaterThan(scores[1])
  })

  it('[MATCH-05] perfil incompleto retorna 422 com os campos faltantes', async () => {
    const { headers } = await makeAdopter('match-05', false)
    const response = await request(app).get('/api/me/matches').set(headers)
    expect(response.status).toBe(422)
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'housing' })]),
    )
  })

  it('[MATCH-06] pets adotados e arquivados ficam fora do ranking', async () => {
    const { headers } = await makeAdopter('match-06')
    await makePet('match-06-available')
    await makePet('match-06-adopted', { status: 'ADOTADO' })
    await makePet('match-06-archived', { status: 'ARQUIVADO' })

    const response = await request(app).get('/api/me/matches').set(headers)
    expect(response.status).toBe(200)
    expect(response.body.data.map((pet: { id: string }) => pet.id)).toEqual(['match-06-available'])
  })

  it('[MATCH-07] trocar a estratégia não exige mudar os controllers', async () => {
    const { headers } = await makeAdopter('match-07')
    await makePet('match-07-pet')
    const stub: MatchingStrategy = {
      calculate: () => ({ score: 42, level: 'Baixa', good: [], attention: [] }),
    }
    const injectedApp = createApp({ matchingStrategy: stub })

    const ranking = await request(injectedApp).get('/api/me/matches').set(headers)
    expect(ranking.status).toBe(200)
    expect(ranking.body.data[0].matching.score).toBe(42)

    const compatibility = await request(injectedApp)
      .get('/api/pets/match-07-pet/compatibility')
      .set(headers)
    expect(compatibility.status).toBe(200)
    expect(compatibility.body.score).toBe(42)
  })

  it('[MATCH-08] limit acima do teto e parâmetros inválidos retornam 400', async () => {
    const { headers } = await makeAdopter('match-08')
    await makePet('match-08-pet')

    const tooLarge = await request(app).get('/api/me/matches?limit=1000000').set(headers)
    expect(tooLarge.status).toBe(400)
    expect(tooLarge.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'limit' })]),
    )

    const invalid = await request(app).get('/api/me/matches?limit=abc').set(headers)
    expect(invalid.status).toBe(400)
  })

  it('[MATCH-09] sem token retorna 401 e o perfil consultado é sempre o do dono do token', async () => {
    const { headers } = await makeAdopter('match-09')
    await makePet('match-09-pet')
    await makeAdopter('match-09-outro')

    expect((await request(app).get('/api/me/matches')).status).toBe(401)
    expect((await request(app).get('/api/pets/match-09-pet/compatibility')).status).toBe(401)

    const baseline = await request(app).get('/api/pets/match-09-pet/compatibility').set(headers)
    const attacker = await request(app)
      .get('/api/pets/match-09-pet/compatibility?userId=match-09-outro')
      .set(headers)
    expect(attacker.status).toBe(200)
    expect(attacker.body).toEqual(baseline.body)
  })
})
