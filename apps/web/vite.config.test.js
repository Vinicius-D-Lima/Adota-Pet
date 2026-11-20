// @vitest-environment node
import { request } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Endereço fixo em IPv4: "localhost" pode resolver para ::1 em alguns ambientes (como o
// runner do CI), e aí o teste conectaria em um endereço diferente do que o servidor abriu.
const HOST = '127.0.0.1'

let server
let port

// O Vite ignora `port: 0` e volta para a 5173, então a porta livre é escolhida aqui.
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createNetServer()
    probe.on('error', reject)
    probe.listen(0, HOST, () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })

beforeAll(async () => {
  port = await freePort()
  server = await createServer({
    configFile: './vite.config.ts',
    server: { host: HOST, port, strictPort: true },
    logLevel: 'silent',
  })
  await server.listen()
})

afterAll(() => server.close())

// O fetch não deixa trocar o cabeçalho Host, então o pedido é feito com node:http.
const statusFor = (host) =>
  new Promise((resolve, reject) => {
    const req = request({ host: HOST, port, path: '/', headers: { Host: host } }, (res) => {
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
