import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, refreshSession } from './api'
import { clearSession, setSession, type AuthTokens } from './session'

// O modo é definido por __AUTH_MODE__; os testes rodam em 'demo', então forçamos
// o modo real aqui para exercitar Bearer/cookie sem depender do Vite.
vi.mock('./session', async (importOriginal) => {
  const original = await importOriginal<typeof import('./session')>()
  let token: string | undefined
  return {
    ...original,
    isRealAuth: () => true,
    getAccessToken: () => token,
    setSession: (data: AuthTokens) => {
      token = data.accessToken
    },
    clearSession: () => {
      token = undefined
    },
  }
})

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

const USER = { id: '1', name: 'Ana', email: 'ana@exemplo.com', role: 'ADOTANTE' }
const TOKENS = { accessToken: 'novo-access', expiresIn: 900, user: USER }

beforeEach(() => {
  vi.unstubAllGlobals()
  clearSession()
})

describe('api - modo real (JWT)', () => {
  it('envia Authorization Bearer e credentials include, sem headers demo', async () => {
    setSession({ ...TOKENS, accessToken: 'access-123' })
    const fetchMock = vi.fn(() => Promise.resolve(json(200, {})))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/me')

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer access-123')
    expect(headers.has('X-Demo-User-Id')).toBe(false)
    expect(init.credentials).toBe('include')
  })

  it('renova uma vez em 401 e repete a requisição com o novo token', async () => {
    setSession({ ...TOKENS, accessToken: 'expirado' })
    const seenTokens: Array<string | null> = []
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      seenTokens.push(new Headers(init.headers).get('Authorization'))
      if (new URL(String(_url), 'http://x').pathname === '/api/auth/refresh') {
        return Promise.resolve(json(200, TOKENS))
      }
      return seenTokens.length < 3
        ? Promise.resolve(json(401, { statusCode: 401, message: 'Unauthorized' }))
        : Promise.resolve(json(200, { ok: true }))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/me')).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(seenTokens[0]).toBe('Bearer expirado')
    expect(seenTokens[2]).toBe('Bearer novo-access')
    const refreshCall = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(refreshCall[1].credentials).toBe('include')
  })

  it('compartilha um único refresh entre requisições concorrentes', async () => {
    setSession({ ...TOKENS, accessToken: 'expirado' })
    let resolveRefresh: (response: Response) => void = () => {}
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.includes('/auth/refresh')) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve
        })
      }
      return new Headers(init.headers).get('Authorization') === 'Bearer novo-access'
        ? Promise.resolve(json(200, { ok: true }))
        : Promise.resolve(json(401, { statusCode: 401, message: 'Unauthorized' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = api.get('/me')
    const second = api.get('/pets')
    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh')),
      ).toHaveLength(1)
    })
    resolveRefresh(json(200, TOKENS))

    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }])
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh')),
    ).toHaveLength(1)
  })

  it('não tenta refresh em rotas /auth e sinaliza 401', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(json(401, { statusCode: 401, message: 'Credenciais inválidas' })),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ statusCode: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refreshSession expõe o promise em voo e o libera ao finalizar', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(200, TOKENS)))
    vi.stubGlobal('fetch', fetchMock)

    const first = refreshSession()
    const second = refreshSession()
    await expect(Promise.all([first, second])).resolves.toEqual([TOKENS, TOKENS])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(refreshSession()).resolves.toEqual(TOKENS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
