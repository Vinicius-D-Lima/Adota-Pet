import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError'
import { login, logout, register, restoreSession } from './auth'
import { clearSession, getAccessToken, getSessionSnapshot } from './session'

const USER = { id: '1', name: 'Ana', email: 'ana@exemplo.com', role: 'ADOTANTE' }
const TOKENS = { accessToken: 'access-1', expiresIn: 900, user: USER }

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  refreshSession: vi.fn(),
}))

import { api, refreshSession } from './api'

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const refreshMock = vi.mocked(refreshSession)

beforeEach(() => {
  vi.clearAllMocks()
  clearSession()
  vi.unstubAllGlobals()
})

describe('serviço de autenticação real', () => {
  it('login guarda o access token e devolve o usuário', async () => {
    postMock.mockResolvedValue(TOKENS)

    await expect(login('ana@exemplo.com', 'Senha@123')).resolves.toEqual(USER)
    expect(postMock).toHaveBeenCalledWith(
      '/auth/login',
      { email: 'ana@exemplo.com', password: 'Senha@123' },
      { skipAuthRefresh: true },
    )
    expect(getAccessToken()).toBe('access-1')
  })

  it('register usa /auth/register e inicia a sessão', async () => {
    postMock.mockResolvedValue(TOKENS)

    await register({ name: 'Ana', email: 'ana@exemplo.com', password: 'Senha@123' })
    expect(postMock).toHaveBeenCalledWith(
      '/auth/register',
      { name: 'Ana', email: 'ana@exemplo.com', password: 'Senha@123' },
      { skipAuthRefresh: true },
    )
    expect(getSessionSnapshot().status).toBe('authenticated')
  })

  it('restaura a sessão com refresh + /me', async () => {
    refreshMock.mockResolvedValue(TOKENS)
    getMock.mockImplementation(async () => {
      expect(getAccessToken()).toBe('access-1')
      return USER
    })

    await expect(restoreSession()).resolves.toEqual(USER)
    expect(refreshMock).toHaveBeenCalledOnce()
    expect(getMock).toHaveBeenCalledWith('/auth/me', { skipAuthRefresh: true })
  })

  it('limpa a sessão se a restauração falhar', async () => {
    setAuthenticatedForTest()
    refreshMock.mockRejectedValue(new ApiError(401, 'Unauthorized'))

    await expect(restoreSession()).rejects.toMatchObject({ statusCode: 401 })
    expect(getSessionSnapshot().status).toBe('anonymous')
  })

  it('logout chama a API e limpa a sessão mesmo se a API falhar', async () => {
    setAuthenticatedForTest()
    postMock.mockRejectedValueOnce(new ApiError(500, 'Erro'))

    await expect(logout()).resolves.toBeUndefined()
    expect(postMock).toHaveBeenCalledWith('/auth/logout', undefined, { skipAuthRefresh: true })
    expect(getSessionSnapshot().status).toBe('anonymous')
  })
})

function setAuthenticatedForTest() {
  postMock.mockResolvedValueOnce(TOKENS)
  return login(USER.email, 'Senha@123')
}
