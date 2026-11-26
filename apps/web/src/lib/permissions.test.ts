import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminPermissions, volunteerPermissions } from '../test/fixtures/organization'
import { TestProviders } from '../test/renderWithProviders'
import { api } from './api'
import { canDo, usePermissions } from './permissions'

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('canDo', () => {
  it('usa as regras devolvidas pela API', () => {
    expect(canDo(adminPermissions, 'update', 'Organization')).toBe(true)
    expect(canDo(volunteerPermissions, 'update', 'Organization')).toBe(false)
    expect(canDo(volunteerPermissions, 'read', 'Pet')).toBe(true)
  })

  it('infere regras do papel quando a API não devolve rules', () => {
    const admin = { ...adminPermissions, rules: undefined }
    const volunteer = { ...volunteerPermissions, rules: undefined }

    expect(canDo(admin, 'manage', 'Member')).toBe(true)
    expect(canDo(volunteer, 'read', 'Pet')).toBe(true)
    expect(canDo(volunteer, 'read', 'Request')).toBe(true)
    expect(canDo(volunteer, 'update', 'Organization')).toBe(false)
    expect(canDo(undefined, 'read', 'Pet')).toBe(false)
  })
})

describe('usePermissions', () => {
  it('carrega /me/permissions e aceita um organizationId opcional', async () => {
    getMock.mockResolvedValue(adminPermissions)
    const { result } = renderHook(() => usePermissions(), { wrapper: TestProviders })

    await waitFor(() => expect(result.current.data).toEqual(adminPermissions))
    expect(getMock).toHaveBeenCalledWith('/me/permissions', undefined)

    getMock.mockClear()
    const scoped = renderHook(() => usePermissions({ organizationId: 'lar-animal' }), {
      wrapper: TestProviders,
    })

    await waitFor(() => expect(scoped.result.current.data).toEqual(adminPermissions))
    expect(getMock).toHaveBeenCalledWith('/me/permissions', {
      query: { organizationId: 'lar-animal' },
    })
  })
})
