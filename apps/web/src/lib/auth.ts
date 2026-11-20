import { api, refreshSession } from './api'
import { ApiError } from './ApiError'
import { clearSession, setSession, type AuthTokens, type AuthUser } from './session'

/**
 * Chamadas de autenticação (#4). Todas passam por `api`, que já anexa o Bearer
 * e trata o cookie de refresh. As chamadas daqui desligam o refresh automático
 * para não criar recursão em /auth/refresh.
 */
const authRequest = { skipAuthRefresh: true } as const

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await api.post<AuthTokens>('/auth/login', { email, password }, authRequest)
  setSession(data)
  return data.user
}

export async function register(input: {
  name: string
  email: string
  password: string
}): Promise<AuthUser> {
  const data = await api.post<AuthTokens>('/auth/register', input, authRequest)
  setSession(data)
  return data.user
}

/** Restaura a sessão no boot: refresh (cookie) e depois /me (token). */
export async function restoreSession(): Promise<AuthUser> {
  try {
    // Usa o mesmo promise de 401 da api: evita duas rotações concorrentes no boot.
    const tokens = await refreshSession()
    // Guarda o access token ANTES de /me: sem isso a requisição sairia sem Bearer.
    setSession(tokens)
    const user = await api.get<AuthUser>('/auth/me', authRequest)
    setSession({ ...tokens, user })
    return user
  } catch (error) {
    clearSession()
    throw error instanceof ApiError ? error : ApiError.network(error)
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout', undefined, authRequest)
  } catch {
    // Mesmo offline a sessão local precisa acabar: não propagamos o erro.
  } finally {
    clearSession()
  }
}
