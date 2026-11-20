import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  getAccessToken,
  profilePathFor,
  setSession,
  type AuthTokens,
} from './session'

const tokens: AuthTokens = {
  accessToken: 'access-123',
  expiresIn: 900,
  user: { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com', role: 'ADOTANTE' },
}

beforeEach(() => {
  clearSession()
  vi.stubGlobal('localStorage', undefined)
  vi.stubGlobal('sessionStorage', undefined)
})

describe('sessão JWT em memória', () => {
  it('guarda tokens apenas em memória e nunca em storage', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { setItem })
    vi.stubGlobal('sessionStorage', { setItem })

    setSession(tokens)

    expect(getAccessToken()).toBe('access-123')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('limpa a sessão no logout', () => {
    setSession(tokens)
    clearSession()
    expect(getAccessToken()).toBeNull()
  })

  it('escolhe o destino inicial pelo papel do usuário', () => {
    expect(profilePathFor({ ...tokens.user, role: 'ADOTANTE' })).toBe('/perfil')
    expect(profilePathFor({ ...tokens.user, role: 'RESPONSAVEL' })).toBe('/perfil?tipo=responsavel')
    expect(profilePathFor({ ...tokens.user, roles: ['GUARDIAN'] })).toBe('/perfil?tipo=responsavel')
    expect(profilePathFor({ ...tokens.user, role: 'MODERADOR' })).toBe('/perfil')
  })
})
