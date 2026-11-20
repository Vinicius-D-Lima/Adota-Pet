import { useSyncExternalStore } from 'react'
import { useAuth } from '../components/AuthProvider'
import {
  getDemoAccountSnapshot,
  getDemoProfilePath,
  hasDemoAccount,
  loginDemoAccount,
  logoutDemoAccount,
  subscribeDemoAccount,
} from '../lib/demoAccount'
import { isRealAuth, profilePathFor, type AuthStatus, type AuthUser } from '../lib/session'

export interface AccountView {
  isAuthenticated: boolean
  profilePath: string
  login: (input: {
    accountType?: 'adopter' | 'guardian'
    email: string
    password?: string
  }) => void | Promise<void>
  logout: () => void | Promise<void>
  register?: (input: { name: string; email: string; password: string }) => Promise<void>
  user?: AuthUser | null
  status?: AuthStatus
}

/** Mantém a API antiga para os módulos legados; no modo real delega ao useAuth. */
export function useDemoAccount(): AccountView {
  const auth = useAuth()
  useSyncExternalStore(subscribeDemoAccount, getDemoAccountSnapshot, getDemoAccountSnapshot)

  if (isRealAuth()) {
    return {
      isAuthenticated: auth.isAuthenticated,
      profilePath: profilePathFor(auth.user),
      login: ({ email, password }) => auth.login({ email, password: password ?? '' }),
      logout: auth.logout,
      register: auth.register,
      user: auth.user,
      status: auth.status,
    }
  }

  return {
    isAuthenticated: hasDemoAccount(),
    profilePath: getDemoProfilePath(),
    login: loginDemoAccount,
    logout: logoutDemoAccount,
  }
}
