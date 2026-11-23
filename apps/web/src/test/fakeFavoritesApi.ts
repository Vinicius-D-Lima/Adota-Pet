import { vi, type Mock } from 'vitest'
import { petFixtures } from './fixtures/pets'

interface ApiMocks {
  get: Mock
  put: Mock
  delete: Mock
}

interface FakeFavoritesApi {
  /** Estado do "servidor": ids favoritados. */
  ids: Set<string>
  /** Chamadas de escrita na ordem em que chegaram, ex.: "PUT luna". */
  writes: string[]
  /** Quando true, PUT e DELETE falham como falha de rede. */
  failWrites: boolean
  /** Com `deferWrites`, libera as escritas pendentes sem depender de timer. */
  releaseWrites: () => void
}

interface FakeOptions {
  initial?: string[]
  writeDelayMs?: number
  /** Mantém PUT/DELETE pendentes até `releaseWrites()` (testes de UI otimista). */
  deferWrites?: boolean
}

/** Simula os endpoints de favoritos do mock sobre um `api` mockado. */
export function fakeFavoritesApi(
  api: ApiMocks,
  { initial = [], writeDelayMs = 0, deferWrites = false }: FakeOptions = {},
): FakeFavoritesApi {
  let gateOpen = !deferWrites
  let releaseGate: (() => void) | undefined
  const server: FakeFavoritesApi = {
    ids: new Set(initial),
    writes: [],
    failWrites: false,
    releaseWrites: () => {
      gateOpen = true
      releaseGate?.()
      releaseGate = undefined
    },
  }
  const delay = async () => {
    if (writeDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, writeDelayMs))
    if (!gateOpen) await new Promise<void>((resolve) => (releaseGate = resolve))
  }
  const petId = (path: string) => decodeURIComponent(path.split('/').pop() as string)

  api.get.mockImplementation((path: string) => {
    if (path === '/me/favorites/ids') {
      return Promise.resolve({ data: [...server.ids], total: server.ids.size })
    }
    if (path === '/me/favorites') {
      const data = petFixtures.filter((pet) => server.ids.has(pet.id))
      return Promise.resolve({ data, total: data.length })
    }
    return Promise.reject(new Error(`GET inesperado: ${path}`))
  })

  const write = (verb: 'PUT' | 'DELETE', apply: (id: string) => void) =>
    vi.fn(async (path: string) => {
      await delay()
      if (server.failWrites) {
        const { ApiError } = await import('../lib/ApiError')
        throw ApiError.network()
      }
      server.writes.push(`${verb} ${petId(path)}`)
      apply(petId(path))
    })

  api.put.mockImplementation(write('PUT', (id) => server.ids.add(id)))
  api.delete.mockImplementation(write('DELETE', (id) => server.ids.delete(id)))

  return server
}
