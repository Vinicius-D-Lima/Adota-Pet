export const DEFAULT_DEMO_ACCOUNT_ID = 'demo'

export const demoAccounts = [
  {
    id: 'demo',
    label: 'Luquinhas — adotante',
    profilePath: '/perfil',
    hasAccount: true,
    hasCompleteProfile: true,
  },
  {
    id: 'demo-organization',
    label: 'Instituto Patinhas — instituição',
    profilePath: '/perfil?tipo=responsavel',
    hasAccount: true,
    hasCompleteProfile: true,
  },
  {
    id: 'demo-empty',
    label: 'Perfil vazio — adotante',
    profilePath: '/perfil',
    hasAccount: false,
    hasCompleteProfile: false,
  },
] as const

export type DemoAccountId = (typeof demoAccounts)[number]['id']

export interface DemoPersonalData {
  name?: string
  cpf?: string
  birthDate?: string
  email?: string
  phone?: string
  zipCode?: string
  address?: string
  organizationName?: string
  responsibleName?: string
  document?: string
  city?: string
  state?: string
}

export function getDemoAccountId(): DemoAccountId {
  const configured = import.meta.env.VITE_DEMO_USER_ID
  return demoAccounts.some(({ id }) => id === configured)
    ? (configured as DemoAccountId)
    : DEFAULT_DEMO_ACCOUNT_ID
}

export function getDemoAccount(accountId = getDemoAccountId()) {
  return demoAccounts.find(({ id }) => id === accountId) ?? demoAccounts[0]
}

const accountStateKey = () =>
  `adotapet:demo-account:${getDemoAccountId()}:${import.meta.env.VITE_DEMO_SESSION_ID ?? 'default'}`

interface CreatedAccountState {
  profilePath: '/perfil' | '/perfil?tipo=responsavel'
  profileComplete: boolean
  personalData: DemoPersonalData | null
  authenticated: boolean
}

const DEMO_ACCOUNT_EVENT = 'adotapet:demo-account-change'

function getCreatedAccount(): CreatedAccountState | null {
  if (typeof sessionStorage === 'undefined') return null
  const value = sessionStorage.getItem(accountStateKey())
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<CreatedAccountState>
    if (!parsed.profilePath) return null
    return {
      profilePath: parsed.profilePath,
      profileComplete: parsed.profileComplete === true,
      personalData: parsed.personalData ?? null,
      // Sessões criadas antes do logout existir representam contas autenticadas.
      authenticated: parsed.authenticated !== false,
    }
  } catch {
    return null
  }
}

/** No mock, o perfil vazio representa alguém que ainda não criou uma conta. */
export function hasDemoAccount(): boolean {
  const session = getCreatedAccount()
  return session ? session.authenticated : getDemoAccount().hasAccount
}

export function createDemoAccount(
  profilePath: CreatedAccountState['profilePath'],
  personalData: DemoPersonalData,
) {
  sessionStorage.setItem(
    accountStateKey(),
    JSON.stringify({ profilePath, profileComplete: false, personalData, authenticated: true }),
  )
  notifyDemoAccountChange()
}

export function getDemoPersonalData(): DemoPersonalData | null {
  return getCreatedAccount()?.personalData ?? null
}

export function getDemoProfilePath(): string {
  return getCreatedAccount()?.profilePath ?? getDemoAccount().profilePath
}

export function hasCompleteDemoProfile(): boolean {
  const session = getCreatedAccount()
  return session
    ? session.authenticated && session.profileComplete
    : getDemoAccount().hasCompleteProfile
}

/** Libera as ações protegidas após o formulário correspondente ser salvo. */
export function completeDemoProfile(profilePath: CreatedAccountState['profilePath']) {
  const account = getCreatedAccount()
  if (!account) return
  sessionStorage.setItem(
    accountStateKey(),
    JSON.stringify({ ...account, profilePath, profileComplete: true }),
  )
  notifyDemoAccountChange()
}

export function logoutDemoAccount() {
  const account = getCreatedAccount()
  sessionStorage.setItem(
    accountStateKey(),
    JSON.stringify({
      profilePath: account?.profilePath ?? getDemoAccount().profilePath,
      profileComplete: false,
      personalData: account?.personalData ?? null,
      authenticated: false,
    }),
  )
  notifyDemoAccountChange()
}

function notifyDemoAccountChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEMO_ACCOUNT_EVENT))
}

export function subscribeDemoAccount(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(DEMO_ACCOUNT_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(DEMO_ACCOUNT_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export function getDemoAccountSnapshot(): string {
  const session = getCreatedAccount()
  return session
    ? JSON.stringify(session)
    : `${getDemoAccountId()}:${getDemoAccount().hasAccount}:${getDemoAccount().profilePath}`
}
