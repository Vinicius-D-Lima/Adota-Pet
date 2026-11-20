/**
 * Sessão autenticada da web (#4/#5).
 *
 * O access token vive **somente em memória**: nunca em localStorage/sessionStorage.
 * O refresh fica no cookie httpOnly definido pela API (#48). No modo mock
 * (`__AUTH_MODE__ === 'demo'`) a sessão continua sendo a conta de demonstração.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthUser {
  id: string
  name: string
  email: string
  platformRole?: 'USUARIO' | 'MODERADOR'
  role?: string
  roles?: string[]
}

export interface AuthSession {
  status: AuthStatus
  user: AuthUser | null
  accessToken: string | null
}

export interface AuthTokens {
  user: AuthUser
  accessToken: string
  expiresIn: number
}

export const AUTH_MODE: 'real' | 'demo' =
  typeof __AUTH_MODE__ === 'undefined' ? 'demo' : __AUTH_MODE__

export const isRealAuth = () => AUTH_MODE === 'real'

let snapshot: AuthSession = {
  status: isRealAuth() ? 'loading' : 'anonymous',
  user: null,
  accessToken: null,
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getSessionSnapshot = () => snapshot
export const getAccessToken = () => snapshot.accessToken

export function setLoading() {
  snapshot = { status: 'loading', user: null, accessToken: null }
  emit()
}

export function setSession({ user, accessToken }: AuthTokens) {
  snapshot = { status: 'authenticated', user, accessToken }
  emit()
}

export function clearSession() {
  snapshot = { status: 'anonymous', user: null, accessToken: null }
  emit()
}

/** Atualiza os dados do usuário sem perder o access token (ex.: após salvar o perfil). */
export function updateUser(user: AuthUser) {
  if (snapshot.status !== 'authenticated') return
  snapshot = { ...snapshot, user }
  emit()
}

/** Caminho do perfil usado pelos guards da aplicação. */
export function profilePathFor(user: AuthUser | null): string {
  const isGuardian = Boolean(user?.roles?.includes('GUARDIAN') || user?.role === 'RESPONSAVEL')
  return isGuardian ? '/perfil?tipo=responsavel' : '/perfil'
}
