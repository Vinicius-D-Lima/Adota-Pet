import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import type { Pet } from '../types'
import { PetDetailPage } from './PetDetailPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ api: { get: mocks.get } }))

const setup = (pet: Pet) => {
  mocks.get.mockReset()
  mocks.get.mockImplementation((path: string) =>
    Promise.resolve(String(path).startsWith('/me/favorites') ? { data: [], total: 0 } : pet),
  )
  return renderWithProviders(
    <Routes>
      <Route path="/pets/:petId" element={<PetDetailPage />} />
    </Routes>,
    { route: `/pets/${pet.id}` },
  )
}

describe('PetDetailPage - saúde do pet', () => {
  beforeEach(() => mocks.get.mockReset())

  it('mostra vacinação e castração quando verdadeiras', async () => {
    setup({ ...petFixture, vaccinated: true, neutered: true })
    expect(await screen.findByText('Vacinado')).toBeInTheDocument()
    expect(screen.getByText('Castrado')).toBeInTheDocument()
  })

  it('mostra os estados negativos quando falsos', async () => {
    setup({ ...petFixture, vaccinated: false, neutered: false })
    expect(await screen.findByText('Não vacinado')).toBeInTheDocument()
    expect(screen.getByText('Não castrado')).toBeInTheDocument()
  })
})
