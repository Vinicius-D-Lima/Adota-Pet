import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, buildUrl } from './api'
import { ApiError } from './ApiError'
import { shouldRetry } from './queryClient'

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

const mockFetch = (impl: () => Promise<Response>) => {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('buildUrl', () => {
  it('usa /api por padrão e monta a query ignorando valores vazios', () => {
    expect(buildUrl('/pets', { species: 'Gato', q: undefined, page: 2 })).toBe(
      '/api/pets?species=Gato&page=2',
    )
  })

  it('respeita VITE_API_URL', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com/v1/')
    expect(buildUrl('pets')).toBe('https://api.exemplo.com/v1/pets')
  })
})

describe('api', () => {
  it('retorna o JSON em caso de sucesso', async () => {
    mockFetch(() => Promise.resolve(json(200, [{ id: 'luna' }])))
    await expect(api.get('/pets')).resolves.toEqual([{ id: 'luna' }])
  })

  it('serializa JSON no corpo com Content-Type', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(json(201, { id: 1 })))
    await api.post('/requests', { petId: 'luna' })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"petId":"luna"}')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('envia FormData sem definir Content-Type', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(json(201, {})))
    const form = new FormData()
    form.append('file', new Blob(['x']), 'foto.png')
    await api.post('/uploads', form)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.body).toBe(form)
    expect(new Headers(init.headers).has('Content-Type')).toBe(false)
  })

  it('retorna undefined em 204', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 204 })))
    await expect(api.delete('/requests/1')).resolves.toBeUndefined()
  })

  it.each([
    [404, 'Pet não encontrado'],
    [409, 'Solicitação já existe'],
    [422, 'Dados inválidos'],
  ])('converte %i em ApiError com statusCode e message', async (statusCode, message) => {
    mockFetch(() => Promise.resolve(json(statusCode, { statusCode, message })))
    const error = await api.get('/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ statusCode, message })
  })

  it('converte falha de rede em ApiError com statusCode 0', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    const error = await api.get('/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).isNetworkError).toBe(true)
  })

  it('tolera erro sem corpo JSON', async () => {
    mockFetch(() => Promise.resolve(new Response('oops', { status: 500, statusText: 'Boom' })))
    await expect(api.get('/x')).rejects.toMatchObject({ statusCode: 500, message: 'Boom' })
  })
})

describe('ApiError.toFieldErrors', () => {
  it('mapeia details em array para erros de campo', async () => {
    mockFetch(() =>
      Promise.resolve(
        json(400, {
          statusCode: 400,
          message: 'Validação falhou',
          details: [
            { field: 'email', message: 'E-mail inválido' },
            { path: ['endereco', 'cep'], message: 'CEP inválido' },
          ],
        }),
      ),
    )
    const error = (await api.post('/x', {}).catch((e: unknown) => e)) as ApiError
    expect(error.toFieldErrors()).toEqual({
      email: 'E-mail inválido',
      'endereco.cep': 'CEP inválido',
    })
  })

  it('mapeia details em objeto e retorna vazio sem details', () => {
    expect(new ApiError(400, 'x', { nome: ['Obrigatório', 'Curto'] }).toFieldErrors()).toEqual({
      nome: 'Obrigatório',
    })
    expect(new ApiError(500, 'x').toFieldErrors()).toEqual({})
  })
})

describe('shouldRetry', () => {
  it('não repete 4xx', () => {
    expect(shouldRetry(0, new ApiError(404, 'x'))).toBe(false)
  })

  it('repete rede e 5xx até 2 vezes', () => {
    expect(shouldRetry(0, ApiError.network())).toBe(true)
    expect(shouldRetry(1, new ApiError(503, 'x'))).toBe(true)
    expect(shouldRetry(2, new ApiError(503, 'x'))).toBe(false)
  })
})
