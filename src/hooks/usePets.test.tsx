import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { petFixture, petFixtures } from '../test/fixtures/pets'
import { createTestQueryClient } from '../test/renderWithProviders'
import { usePet, usePets } from './usePets'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ api: { get: mocks.get } }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
)

beforeEach(() => mocks.get.mockReset())

describe('hooks de pets', () => {
  it('consulta a lista paginada com os filtros da API', async () => {
    mocks.get.mockResolvedValue({ data: petFixtures.slice(0, 4), total: petFixtures.length })
    const filters = { species: 'Gato', sort: 'recent' as const, limit: 4 }
    const { result } = renderHook(() => usePets(filters), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.get).toHaveBeenCalledWith('/pets', expect.objectContaining({
      query: expect.objectContaining({ species: 'Gato', sort: 'recent', limit: 4, page: 1 }),
    }))
    expect(result.current.data?.pages[0].total).toBe(6)
  })

  it('consulta um pet pelo id', async () => {
    mocks.get.mockResolvedValue(petFixture)
    const { result } = renderHook(() => usePet('luna'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.get).toHaveBeenCalledWith('/pets/luna', expect.any(Object))
    expect(result.current.data?.name).toBe('Luna')
  })
})
