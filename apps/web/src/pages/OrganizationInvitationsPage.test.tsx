import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { api } from '../lib/api'
import { adminPermissions, organizationInvitations } from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { OrganizationInvitationsPage } from './OrganizationInvitationsPage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const deleteMock = vi.mocked(api.delete)
const invitationsPath = '/organizations/demo-organization/invitations'
let writeText: MockInstance<(text: string) => Promise<void>>

beforeEach(() => {
  sessionStorage.clear()
  getMock.mockImplementation((path: string) => {
    if (String(path).startsWith('/me/permissions')) return Promise.resolve(adminPermissions)
    if (String(path) === invitationsPath) {
      return Promise.resolve({
        data: organizationInvitations,
        total: organizationInvitations.length,
      })
    }
    return Promise.resolve({ data: [], total: 0 })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('OrganizationInvitationsPage', () => {
  it('lista convites pendentes e copia o link de aceite', async () => {
    const user = userEvent.setup()
    // O user-event instala o clipboard no jsdom; o spy captura o link copiado.
    writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    renderWithProviders(<OrganizationInvitationsPage />)

    const item = (await screen.findByText('ana@adotapet.local')).closest('li')
    expect(item).not.toBeNull()
    expect(within(item as HTMLElement).getByRole('button', { name: /copiar link/i })).toBeEnabled()

    await user.click(within(item as HTMLElement).getByRole('button', { name: /copiar link/i }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/convite/token-com-mais-de-vinte-caracteres`,
      ),
    )
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument()
  })

  it('envia um novo convite por e-mail com o papel escolhido', async () => {
    postMock.mockResolvedValue({
      id: 'convite-2',
      email: 'bruno@adotapet.local',
      role: 'ADMIN',
      status: 'PENDENTE',
      expiresAt: '2026-12-10T12:00:00.000Z',
      token: 'outro-token-com-mais-de-vinte-caracteres',
    })
    const user = userEvent.setup()
    renderWithProviders(<OrganizationInvitationsPage />)

    await user.type(await screen.findByLabelText('E-mail'), 'bruno@adotapet.local')
    await user.selectOptions(screen.getByLabelText('Papel'), 'ADMIN')
    await user.click(screen.getByRole('button', { name: /enviar convite/i }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(invitationsPath, {
        email: 'bruno@adotapet.local',
        role: 'ADMIN',
      }),
    )
  })

  it('revoga um convite após confirmação', async () => {
    deleteMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<OrganizationInvitationsPage />)

    await user.click(await screen.findByRole('button', { name: /revogar/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revogar convite' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(`${invitationsPath}/convite-1`))
  })
})
