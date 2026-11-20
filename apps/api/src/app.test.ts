import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

describe('GET /health', () => {
  it('responde 200 com status ok quando o banco está disponível', async () => {
    const response = await request(createApp({ checkDatabase: async () => true })).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', database: 'ok' })
  })
})

describe('CORS', () => {
  it('responde ao preflight da origem configurada', async () => {
    const response = await request(createApp({ checkDatabase: async () => true }))
      .options('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('envia o cabeçalho CORS em pedido simples', async () => {
    const response = await request(createApp({ checkDatabase: async () => true }))
      .get('/health')
      .set('Origin', 'http://localhost:5173')

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })
})
