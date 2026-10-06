import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { TestProviders } from '../test/renderWithProviders'
import { useAdopterProfile } from './useAdopterProfile'
import { useGuardianProfile } from './useGuardianProfile'

const personalData = {
  name: 'Maria da Silva',
  cpf: '52998224725',
  birthDate: '1990-05-20',
  email: 'maria@exemplo.com',
  phone: '11999999999',
  zipCode: '01310100',
  address: 'Avenida Paulista, 1000 - São Paulo, SP',
}

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../lib/demoAccount', () => ({
  getDemoPersonalData: () => personalData,
  completeDemoProfile: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('dados pessoais criados junto com a conta', () => {
  it('preenche o início do perfil de adotante e remove esses campos das pendências', async () => {
    vi.mocked(api.get).mockResolvedValue({
      isComplete: false,
      missingFields: ['name', 'cpf', 'email', 'housing'],
    })
    const { result } = renderHook(() => useAdopterProfile(), { wrapper: TestProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.profile).toMatchObject(personalData)
    expect(result.current.data?.missingFields).toContain('housing')
    expect(result.current.data?.missingFields).not.toEqual(
      expect.arrayContaining(['name', 'cpf', 'birthDate', 'email', 'phone', 'zipCode', 'address']),
    )
  })

  it('reaproveita identificação e contato no perfil de responsável', async () => {
    vi.mocked(api.get).mockResolvedValue({
      isComplete: false,
      missingFields: ['legalName', 'email', 'phone', 'guardianType'],
    })
    const { result } = renderHook(() => useGuardianProfile(), { wrapper: TestProviders })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.profile).toMatchObject({
      legalName: personalData.name,
      email: personalData.email,
      phone: personalData.phone,
      zipCode: personalData.zipCode,
      address: personalData.address,
    })
    expect(result.current.data?.missingFields).toContain('guardianType')
    expect(result.current.data?.missingFields).not.toEqual(
      expect.arrayContaining(['legalName', 'email', 'phone', 'zipCode', 'address']),
    )
  })
})
