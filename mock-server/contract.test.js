// @vitest-environment node
import { readFileSync } from 'node:fs'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { adoptionRequestSchema, adoptionRequestsResponseSchema } from '../src/schemas/requestSchema'
import { SEED_PATH, createApp } from './server.js'

// Garante que o que o mock devolve é aceito pelos schemas que o frontend usa para validar a API.
let app
beforeEach(() => {
  app = createApp({ db: JSON.parse(readFileSync(SEED_PATH, 'utf8')), delay: 0 })
})

const answers = {
  motivation: 'Quero muito adotar e oferecer um lar cheio de carinho.',
  routine: 'Trabalho em casa e passeio todos os dias com calma.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço tranquilo para a adaptação.',
  costs: true,
  commitment: true,
}

describe('contrato mock x schemas do frontend', () => {
  it('GET /me/requests é aceito por adoptionRequestsResponseSchema', async () => {
    const res = await request(app).get('/me/requests')
    expect(res.status).toBe(200)
    expect(adoptionRequestsResponseSchema.safeParse(res.body).error).toBeUndefined()
  })

  it('GET /requests/:id é aceito por adoptionRequestSchema', async () => {
    const res = await request(app).get('/requests/SOL-1042')
    expect(res.status).toBe(200)
    expect(adoptionRequestSchema.safeParse(res.body).error).toBeUndefined()
  })

  it('POST /requests e a transição de cancelamento são aceitos por adoptionRequestSchema', async () => {
    const created = await request(app).post('/requests').send({ petId: 'bento', answers })
    expect(created.status).toBe(201)
    expect(adoptionRequestSchema.safeParse(created.body).error).toBeUndefined()

    const cancelled = await request(app)
      .post(`/requests/${created.body.id}/transitions`)
      .send({ to: 'CANCELADA' })
    expect(cancelled.status).toBe(200)
    expect(adoptionRequestSchema.safeParse(cancelled.body).error).toBeUndefined()
  })
})
