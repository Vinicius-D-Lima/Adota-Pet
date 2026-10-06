import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { makeRequest, requestPet } from '../test/fixtures/requests'
import { renderWithProviders } from '../test/renderWithProviders'
import { formatRequestDate } from '../utils/formatRequestDate'
import { RequestSuccessPage } from './RequestSuccessPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))

const getMock = vi.mocked(api.get)

function setup() {
  renderWithProviders(
    <Routes>
      <Route path="/solicitacoes/:requestId/enviada" element={<RequestSuccessPage />} />
      <Route path="/solicitacoes" element={<p>Minhas solicitações</p>} />
    </Routes>,
    { route: '/solicitacoes/SOL-1042/enviada' },
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('RequestSuccessPage', () => {
  it('busca GET /requests/:id e usa o pet embutido', async () => {
    getMock.mockResolvedValue(makeRequest())
    setup()

    expect(
      await screen.findByText(new RegExp(`com a equipe que cuida de ${requestPet.name}`, 'i')),
    ).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('/requests/SOL-1042')
  })

  it('mostra a data real da solicitação em vez de um texto fixo', async () => {
    getMock.mockResolvedValue(makeRequest({ date: '2026-09-08T12:00:00.000Z' }))
    setup()

    expect(
      await screen.findByText(`Enviada em ${formatRequestDate('2026-09-08T12:00:00.000Z')}`),
    ).toBeInTheDocument()
    expect(screen.queryByText('Enviada agora')).not.toBeInTheDocument()
    expect(screen.getByText(/set\.? de 2026/)).toBeInTheDocument()
  })

  it('mostra "Solicitação não encontrada" com link para a listagem quando a API responde 404', async () => {
    getMock.mockRejectedValue(new ApiError(404, 'Solicitação não encontrada'))
    setup()

    expect(
      await screen.findByRole('heading', { name: 'Solicitação não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver minhas solicitações' })).toHaveAttribute(
      'href',
      '/solicitacoes',
    )
  })
})
