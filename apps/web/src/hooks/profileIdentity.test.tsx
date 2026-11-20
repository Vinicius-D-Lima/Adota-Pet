import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { useAdopterProfile } from './useAdopterProfile'
import { useGuardianProfile } from './useGuardianProfile'

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

const mocks = vi.hoisted(() => ({
  demoData: {
    name: 'Luquinhas',
    email: 'lucas@exemplo.com',
    organizationName: 'Instituto Patinhas',
    responsibleName: 'Maria da Silva',
    guardianType: 'ORGANIZATION' as const,
  },
}))

vi.mock('../lib/demoAccount', () => ({
  getDemoPersonalData: () => mocks.demoData,
  completeDemoProfile: vi.fn(),
}))

vi.mock('../lib/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/session')>()
  return { ...original, isRealAuth: () => true }
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.demoData = {
    name: 'Luquinhas',
    email: 'lucas@exemplo.com',
    organizationName: 'Instituto Patinhas',
    responsibleName: 'Maria da Silva',
    guardianType: 'ORGANIZATION',
  }
})

describe('identidade no modo real', () => {
  it('não preenche o perfil do adotante com dados deixados pelo mock', async () => {
    vi.mocked(api.get).mockResolvedValue({
      userId: 'usuario-real',
      isComplete: false,
      missingFields: ['name', 'email'],
    })

    const { result } = renderHook(() => useAdopterProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.profile.name).toBe('')
    expect(result.current.data?.profile.email).toBe('')
  })

  it('não preenche o perfil do responsável com dados deixados pelo mock', async () => {
    vi.mocked(api.get).mockResolvedValue({
      userId: 'ong-real',
      isComplete: false,
      missingFields: ['displayName', 'legalName', 'email'],
    })

    const { result } = renderHook(() => useGuardianProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.profile.displayName).toBe('')
    expect(result.current.data?.profile.legalName).toBe('')
    expect(result.current.data?.profile.email).toBe('')
  })

  it('mantém os dados vindos da API do usuário autenticado', async () => {
    vi.mocked(api.get).mockResolvedValue({
      userId: 'usuario-real',
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      isComplete: true,
      missingFields: [],
    })

    const { result } = renderHook(() => useAdopterProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.profile.name).toBe('Ana Souza')
    expect(result.current.data?.profile.email).toBe('ana@exemplo.com')
  })
})
