import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

describe('GET /health', () => {
  it('responde 200 com status ok', async () => {
    const response = await request(createApp()).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})

describe('CORS', () => {
  it('reflete a origem do pedido no preflight', async () => {
    const response = await request(createApp())
      .options('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('envia o cabeçalho CORS em pedido simples', async () => {
    const response = await request(createApp())
      .get('/health')
      .set('Origin', 'http://localhost:5173')

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })
})
