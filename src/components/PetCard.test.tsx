import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import { PetCard } from './PetCard'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ api: { get: mocks.get } }))

beforeEach(() => {
  mocks.get.mockReset()
  mocks.get.mockResolvedValue({ data: [], total: 0 })
})

describe('PetCard - selos de saúde', () => {
  it('mostra "Vacinado" e "Castrado" quando verdadeiros', async () => {
    renderWithProviders(<PetCard pet={{ ...petFixture, vaccinated: true, neutered: true }} />)
    expect(screen.getByText('Vacinado')).toBeInTheDocument()
    expect(screen.getByText('Castrado')).toBeInTheDocument()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())
  })

  it('mostra "Não vacinado" e "Não castrado" quando falsos', async () => {
    renderWithProviders(<PetCard pet={{ ...petFixture, vaccinated: false, neutered: false }} />)
    expect(screen.getByText('Não vacinado')).toBeInTheDocument()
    expect(screen.getByText('Não castrado')).toBeInTheDocument()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())
  })
})
