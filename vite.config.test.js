// @vitest-environment node
import { request } from 'node:http'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let server
let port

beforeAll(async () => {
  server = await createServer({
    configFile: './vite.config.ts',
    server: { port: 0, strictPort: false },
    logLevel: 'silent',
  })
  await server.listen()
  port = server.httpServer.address().port
})

afterAll(() => server.close())

// O fetch não deixa trocar o cabeçalho Host, então o pedido é feito com node:http.
const statusFor = (host) =>
  new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/', headers: { Host: host } }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', reject)
    req.end()
  })

describe('hosts aceitos pelo servidor de desenvolvimento', () => {
  it('aceita localhost', async () => {
    expect(await statusFor(`localhost:${port}`)).toBe(200)
  })

  it('aceita o endereço do GitHub Codespaces (*.app.github.dev)', async () => {
    expect(await statusFor('urban-space-giggle-abc123-5173.app.github.dev')).toBe(200)
  })

  it('continua recusando domínios que não foram liberados', async () => {
    expect(await statusFor('site-qualquer.example.com')).toBe(403)
  })
})
