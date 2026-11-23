import type { Express } from 'express'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { savedFiltersRouter } from './routes/savedFilters.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

const CRITERIA = {
  search: 'Luna',
  species: 'Cachorro',
  size: ['Médio'],
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

  afterEach(resetTestDatabase)

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
})
