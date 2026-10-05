import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { makeRequest } from '../test/fixtures/requests'
import { validProfile } from '../test/fixtures/profile'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import type { AdoptionRequest } from '../types'
import { CompatibilityPage } from './CompatibilityPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))

const mocks = vi.hoisted(() => ({ usePet: vi.fn(), useAdopterProfile: vi.fn() }))
vi.mock('../hooks/usePets', () => ({ usePet: mocks.usePet }))
vi.mock('../hooks/useAdopterProfile', () => ({ useAdopterProfile: mocks.useAdopterProfile }))

const getMock = vi.mocked(api.get)

beforeEach(() => {
  mocks.usePet.mockReturnValue({ data: petFixture, isPending: false, isError: false })
  mocks.useAdopterProfile.mockReturnValue({
    data: { profile: validProfile },
    isPending: false,
    isError: false,
  })
})

function setup(requests: AdoptionRequest[]) {
  getMock.mockResolvedValue({ data: requests, total: requests.length })
  renderWithProviders(
    <Routes>
      <Route path="/pets/:petId/compatibilidade" element={<CompatibilityPage />} />
    </Routes>,
    { route: `/pets/${petFixture.id}/compatibilidade` },
  )
}

const questionnaireLink = () =>
  screen.queryByRole('link', { name: /continuar para o questionário/i })

afterEach(() => {
  vi.clearAllMocks()
})

describe('CompatibilityPage - solicitação ativa', () => {
  it('sem solicitação mostra o botão para o questionário', async () => {
    setup([])

    expect(
      await screen.findByRole('link', { name: /continuar para o questionário/i }),
    ).toHaveAttribute('href', `/pets/${petFixture.id}/questionario`)
    expect(screen.queryByText(/você já tem uma solicitação/i)).not.toBeInTheDocument()
  })

  it('com solicitação ativa troca o botão pelo aviso com link para /solicitacoes', async () => {
    setup([makeRequest({ id: 'SOL-1042', petId: petFixture.id, status: 'Enviada' })])

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(
      `Você já tem uma solicitação em andamento para ${petFixture.name} (SOL-1042 · Enviada)`,
    )
    expect(screen.getByRole('link', { name: /ver minhas solicitações/i })).toHaveAttribute(
      'href',
      '/solicitacoes',
    )
    expect(questionnaireLink()).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /rever detalhes/i })).toBeInTheDocument()
  })

  it('solicitação Cancelada não bloqueia: o botão volta', async () => {
    setup([makeRequest({ petId: petFixture.id, status: 'Cancelada' })])

    expect(
      await screen.findByRole('link', { name: /continuar para o questionário/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('enquanto a lista carrega mantém o botão, sem piscar o aviso', async () => {
    getMock.mockReturnValue(new Promise(() => {}))
    renderWithProviders(
      <Routes>
        <Route path="/pets/:petId/compatibilidade" element={<CompatibilityPage />} />
      </Routes>,
      { route: `/pets/${petFixture.id}/compatibilidade` },
    )

    expect(
      await screen.findByRole('link', { name: /continuar para o questionário/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
