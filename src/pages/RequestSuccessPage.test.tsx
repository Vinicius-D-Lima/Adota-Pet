import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { makeRequest, requestPet } from '../test/fixtures/requests'
import { renderWithProviders } from '../test/renderWithProviders'
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

  it('redireciona para /solicitacoes quando a API responde 404', async () => {
    getMock.mockRejectedValue(new ApiError(404, 'Solicitação não encontrada'))
    setup()

    expect(await screen.findByText('Minhas solicitações')).toBeInTheDocument()
  })
})
