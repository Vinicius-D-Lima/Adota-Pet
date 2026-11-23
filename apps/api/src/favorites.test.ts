import type { Express } from 'express'
import { favoriteIdsResponseSchema, favoritesResponseSchema } from '@adotapet/shared'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

async function makeUser(id: string) {
  const user = await prisma.user.create({
    data: {
      id,
      name: `Usuário ${id}`,
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
    },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makePet(id: string, status = 'DISPONIVEL') {
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
      organization: 'Instituição Patinhas',
      organizationInitials: 'IP',
      createdAt: new Date(),
      status,
    },
  })
}

const putFavorite = (app: Express, headers: Record<string, string>, petId: string) =>
  request(app).put(`/api/me/favorites/${petId}`).set(headers)

const deleteFavorite = (app: Express, headers: Record<string, string>, petId: string) =>
  request(app).delete(`/api/me/favorites/${petId}`).set(headers)

const getIds = (app: Express, headers: Record<string, string>) =>
  request(app).get('/api/me/favorites/ids').set(headers)

databaseSuite('favoritos (#51)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    // App nova por teste: o rate limit tem estado em memória.
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[FAV-01] favoritar é idempotente', async () => {
    const { headers } = await makeUser('fav-01-user')
    await makePet('fav-01-pet')

    expect((await putFavorite(app, headers, 'fav-01-pet')).status).toBe(204)
    const first = await prisma.favorite.findUniqueOrThrow({
      where: { userId_petId: { userId: 'fav-01-user', petId: 'fav-01-pet' } },
    })

    expect((await putFavorite(app, headers, 'fav-01-pet')).status).toBe(204)
    expect(await prisma.favorite.count({ where: { userId: 'fav-01-user' } })).toBe(1)
    const second = await prisma.favorite.findUniqueOrThrow({
      where: { userId_petId: { userId: 'fav-01-user', petId: 'fav-01-pet' } },
    })
    expect(second.createdAt.toISOString()).toBe(first.createdAt.toISOString())
    expect((await getIds(app, headers)).body.data).toEqual(['fav-01-pet'])
  })

  it('[FAV-02] desfavoritar o que não estava favoritado retorna 204', async () => {
    const { headers } = await makeUser('fav-02-user')
    await makePet('fav-02-pet')
    await putFavorite(app, headers, 'fav-02-pet')

    expect((await deleteFavorite(app, headers, 'fav-02-pet')).status).toBe(204)
    expect((await deleteFavorite(app, headers, 'fav-02-pet')).status).toBe(204)
    expect((await deleteFavorite(app, headers, 'fav-02-nunca-favoritado')).status).toBe(204)

    expect(await prisma.favorite.count({ where: { userId: 'fav-02-user' } })).toBe(0)
    expect((await getIds(app, headers)).body.data).toEqual([])
  })

  it('[FAV-03] pet inexistente retorna 404', async () => {
    const { headers } = await makeUser('fav-03-user')

    const response = await putFavorite(app, headers, 'pet-que-nao-existe')

    expect(response.status).toBe(404)
    expect(await prisma.favorite.count({ where: { userId: 'fav-03-user' } })).toBe(0)
  })

  it('[FAV-04] cada usuário só vê e altera os próprios favoritos', async () => {
    const alice = await makeUser('fav-04-alice')
    const bob = await makeUser('fav-04-bob')
    await makePet('fav-04-pet-a')
    await makePet('fav-04-pet-b')
    await putFavorite(app, alice.headers, 'fav-04-pet-a')
    await putFavorite(app, bob.headers, 'fav-04-pet-b')

    const aliceIds = await getIds(app, alice.headers)
    const aliceList = await request(app).get('/api/me/favorites').set(alice.headers)
    expect(aliceIds.body.data).toEqual(['fav-04-pet-a'])
    expect(aliceList.body.data.map((pet: { id: string }) => pet.id)).toEqual(['fav-04-pet-a'])

    // DELETE de A não pode apagar o vínculo de B, mesmo apontando para o mesmo pet.
    expect((await deleteFavorite(app, alice.headers, 'fav-04-pet-b')).status).toBe(204)
    expect((await getIds(app, bob.headers)).body.data).toEqual(['fav-04-pet-b'])
    expect((await getIds(app, alice.headers)).body.data).toEqual(['fav-04-pet-a'])

    // O mesmo pet pode ser favoritado por ambos; cada linha pertence ao seu dono.
    expect((await putFavorite(app, alice.headers, 'fav-04-pet-b')).status).toBe(204)
    expect((await getIds(app, bob.headers)).body.data).toEqual(['fav-04-pet-b'])
    expect(new Set((await getIds(app, alice.headers)).body.data)).toEqual(
      new Set(['fav-04-pet-a', 'fav-04-pet-b']),
    )
  })

  it('[FAV-05] sem token retorna 401 em todas as rotas', async () => {
    const cases: Array<{ method: 'get' | 'put' | 'delete'; path: string }> = [
      { method: 'get', path: '/api/me/favorites' },
      { method: 'get', path: '/api/me/favorites/ids' },
      { method: 'put', path: '/api/me/favorites/pet' },
      { method: 'delete', path: '/api/me/favorites/pet' },
    ]

    for (const { method, path } of cases) {
      expect((await request(app)[method](path)).status).toBe(401)
    }
  })

  it('[FAV-06] lista paginada com dados resumidos e status do pet', async () => {
    const { headers } = await makeUser('fav-06-user')
    await makePet('fav-06-disponivel', 'DISPONIVEL')
    await makePet('fav-06-adotado', 'ADOTADO')
    await makePet('fav-06-arquivado', 'ARQUIVADO')
    for (const id of ['fav-06-disponivel', 'fav-06-adotado', 'fav-06-arquivado']) {
      expect((await putFavorite(app, headers, id)).status).toBe(204)
    }

    const firstPage = await request(app).get('/api/me/favorites?page=1&limit=2').set(headers)
    expect(firstPage.status).toBe(200)
    expect(() => favoritesResponseSchema.parse(firstPage.body)).not.toThrow()
    // `total` é global: não pode ser o tamanho da página.
    expect(firstPage.body.total).toBe(3)
    expect(firstPage.body.data.map((pet: { id: string }) => pet.id)).toEqual([
      'fav-06-disponivel',
      'fav-06-adotado',
    ])
    expect(firstPage.body.data[1].status).toBe('ADOTADO')

    const secondPage = await request(app).get('/api/me/favorites?page=2&limit=2').set(headers)
    expect(secondPage.status).toBe(200)
    expect(secondPage.body.total).toBe(3)
    expect(secondPage.body.data).toHaveLength(1)
    expect(secondPage.body.data[0]).toMatchObject({
      id: 'fav-06-arquivado',
      status: 'ARQUIVADO',
    })

    // Resumo não carrega coordenadas nem o texto longo do pet.
    expect(firstPage.body.data[0]).not.toHaveProperty('lat')
    expect(firstPage.body.data[0]).not.toHaveProperty('lng')
    expect(firstPage.body.data[0]).not.toHaveProperty('description')
  })

  it('[FAV-07] /me/favorites/ids coincide com a lista', async () => {
    const { headers } = await makeUser('fav-07-user')
    for (const id of ['fav-07-a', 'fav-07-b', 'fav-07-c']) {
      await makePet(id)
      await putFavorite(app, headers, id)
    }

    const ids = await getIds(app, headers)
    const list = await request(app).get('/api/me/favorites').set(headers)

    expect(ids.status).toBe(200)
    expect(list.status).toBe(200)
    expect(() => favoriteIdsResponseSchema.parse(ids.body)).not.toThrow()
    expect(() => favoritesResponseSchema.parse(list.body)).not.toThrow()
    expect(ids.body.total).toBe(3)
    expect(ids.body.data).toEqual(list.body.data.map((pet: { id: string }) => pet.id))
  })
})
