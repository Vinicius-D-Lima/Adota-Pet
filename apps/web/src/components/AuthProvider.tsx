import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import * as authService from '../lib/auth'
import { ApiError } from '../lib/ApiError'
import {
  getSessionSnapshot,
  isRealAuth,
  setLoading,
  subscribeSession,
  type AuthStatus,
  type AuthUser,
} from '../lib/session'

export interface LoginInput {
  email: string
  password: string
}

export interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: { name: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function valueFromSnapshot(snapshot: ReturnType<typeof getSessionSnapshot>): AuthContextValue {
  return {
    user: snapshot.user,
    status: snapshot.status,
    isAuthenticated: snapshot.status === 'authenticated',
    login: async (input) => {
      await authService.login(input.email, input.password)
    },
    register: async (input) => {
      await authService.register(input)
    },
    logout: async () => {
      await authService.logout()
    },
  }
}

/**
 * AuthProvider (#4): restaura a sessão no boot com POST /auth/refresh + GET /me.
 * Enquanto isso, `status` é `loading` — os guards não mostram "deslogado".
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isRealAuth()) return
    setLoading()
    void authService.restoreSession().catch((error: unknown) => {
      if (error instanceof ApiError) return
      // Falha de rede já é tratada pelo estado anonymous; não derruba o app.
    })
  }, [])

  const value = useMemo(() => {
    const actions = valueFromSnapshot(snapshot)
    // Dados em cache são por usuário (favoritos, solicitações, perfis). Limpar ao
    // trocar de identidade evita que a conta anterior "vaze" para a próxima.
    const clearCache = () => queryClient.clear()
    return {
      ...actions,
      login: async (input: LoginInput) => {
        await actions.login(input)
        clearCache()
      },
      register: async (input: { name: string; email: string; password: string }) => {
        await actions.register(input)
        clearCache()
      },
      logout: async () => {
        await actions.logout()
        clearCache()
      },
    }
  }, [snapshot, queryClient])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Funciona fora do Provider (testes isolados) lendo direto do módulo de sessão. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  const snapshot = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot)
  return context ?? valueFromSnapshot(snapshot)
}
