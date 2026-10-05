import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeFavoritesApi } from '../test/fakeFavoritesApi'
import { makeRequest } from '../test/fixtures/requests'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import type { AdoptionRequest } from '../types'
import { PetDetailPage } from './PetDetailPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

function setup(requests: AdoptionRequest[]) {
  fakeFavoritesApi(mocks)
  const favoritesGet = mocks.get.getMockImplementation()
  mocks.get.mockImplementation((path: string) => {
    if (path === `/pets/${petFixture.id}`) return Promise.resolve(petFixture)
    if (path === '/me/requests') return Promise.resolve({ data: requests, total: requests.length })
    return favoritesGet?.(path)
  })
  renderWithProviders(
    <Routes>
      <Route path="/pets/:petId" element={<PetDetailPage />} />
    </Routes>,
    { route: `/pets/${petFixture.id}` },
  )
}

const compatibilityLink = () => screen.queryByRole('link', { name: /ver compatibilidade/i })

afterEach(() => {
  vi.clearAllMocks()
})

describe('PetDetailPage - solicitação ativa', () => {
  it('sem solicitação mostra o botão para ver a compatibilidade', async () => {
    setup([])

    expect(await screen.findByRole('heading', { name: petFixture.name })).toBeInTheDocument()
    expect(await screen.findByText(/o resultado é orientativo/i)).toBeInTheDocument()
    expect(compatibilityLink()).toHaveAttribute('href', `/pets/${petFixture.id}/compatibilidade`)
    expect(screen.queryByText(/você já tem uma solicitação/i)).not.toBeInTheDocument()
  })

  it('com solicitação ativa troca o botão pelo aviso com link para /solicitacoes', async () => {
    setup([makeRequest({ id: 'SOL-1042', petId: petFixture.id, status: 'Em análise' })])

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(
      `Você já tem uma solicitação em andamento para ${petFixture.name} (SOL-1042 · Em análise)`,
    )
    expect(screen.getByRole('link', { name: /ver minhas solicitações/i })).toHaveAttribute(
      'href',
      '/solicitacoes',
    )
    expect(compatibilityLink()).not.toBeInTheDocument()
  })

  it.each(['Cancelada', 'Recusada'] as const)(
    'solicitação %s não bloqueia: o botão continua disponível',
    async (status) => {
      setup([makeRequest({ petId: petFixture.id, status })])

      expect(await screen.findByText(/o resultado é orientativo/i)).toBeInTheDocument()
      expect(compatibilityLink()).toBeInTheDocument()
      expect(screen.queryByText(/você já tem uma solicitação/i)).not.toBeInTheDocument()
    },
  )

  it('solicitação ativa de outro pet não bloqueia', async () => {
    setup([makeRequest({ petId: 'outro-pet', status: 'Enviada' })])

    expect(await screen.findByText(/o resultado é orientativo/i)).toBeInTheDocument()
    expect(compatibilityLink()).toBeInTheDocument()
  })
})
