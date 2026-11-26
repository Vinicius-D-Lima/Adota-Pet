import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { renderWithProviders } from '../test/renderWithProviders'
import { InvitationAcceptPage } from './InvitationAcceptPage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const token = 'token-com-mais-de-vinte-caracteres'

const routes = (
  <Routes>
    <Route path="/convite/:token" element={<InvitationAcceptPage />} />
  </Routes>
)

const validPreview = {
  email: 'ana@adotapet.local',
  role: 'VOLUNTEER' as const,
  status: 'PENDENTE' as const,
  expiresAt: '2026-12-10T12:00:00.000Z',
  organization: { id: 'demo-organization', name: 'Instituto Patinhas', initials: 'IP' },
}

afterEach(() => vi.clearAllMocks())

describe('InvitationAcceptPage', () => {
  it.each([
    [400, 'Convite inválido'],
    [403, 'Este convite pertence a outra conta'],
    [410, 'Este convite expirou'],
  ])('mostra erro amigável para o status %i', async (statusCode, message) => {
    getMock.mockRejectedValue(new ApiError(statusCode, message))
    renderWithProviders(routes, { route: `/convite/${token}` })

    expect(await screen.findByText('Este convite não está disponível')).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('mostra organização e papel antes de aceitar', async () => {
    getMock.mockResolvedValue(validPreview)
    renderWithProviders(routes, { route: `/convite/${token}` })

    expect(await screen.findByRole('heading', { name: 'Instituto Patinhas' })).toBeInTheDocument()
    expect(screen.getByText('Voluntário')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeEnabled()
  })

  it('aceita o convite e confirma o ingresso na organização', async () => {
    getMock.mockResolvedValue(validPreview)
    postMock.mockResolvedValue({ organization: validPreview.organization })
    const user = userEvent.setup()
    renderWithProviders(routes, { route: `/convite/${token}` })

    await user.click(await screen.findByRole('button', { name: 'Aceitar' }))

    expect(postMock).toHaveBeenCalledWith(`/invitations/${token}/accept`)
    expect(await screen.findByText('Convite aceito!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /área da organização/i })).toHaveAttribute(
      'href',
      '/organizacao',
    )
  })
})
