import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import {
  adminPermissions,
  organizationDetails,
  volunteerPermissions,
} from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { OrganizationSettingsPage } from './OrganizationSettingsPage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const putMock = vi.mocked(api.put)
const detailsPath = '/organizations/demo-organization'

function setupApi(permissions: typeof adminPermissions) {
  getMock.mockImplementation((path: string) => {
    if (String(path).startsWith('/me/permissions')) return Promise.resolve(permissions)
    if (String(path) === detailsPath) return Promise.resolve(organizationDetails)
    return Promise.resolve({ data: [], total: 0 })
  })
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('OrganizationSettingsPage', () => {
  it('edita e envia os dados da organização como ADMIN', async () => {
    setupApi(adminPermissions)
    putMock.mockResolvedValue(organizationDetails)
    const user = userEvent.setup()
    renderWithProviders(<OrganizationSettingsPage />)

    const displayName = await screen.findByLabelText('Nome de exibição')
    await waitFor(() => expect(displayName).toHaveValue('Instituto Patinhas'))
    await user.clear(displayName)
    await user.type(displayName, 'Instituto Patinhas Atualizado')
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }))

    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith(detailsPath, {
        displayName: 'Instituto Patinhas Atualizado',
        name: organizationDetails.name,
        initials: organizationDetails.initials,
        cnpj: organizationDetails.cnpj,
        document: organizationDetails.document,
        phone: organizationDetails.phone,
        email: organizationDetails.email,
        contactEmail: organizationDetails.email,
        address: organizationDetails.address,
        city: organizationDetails.city,
        description: organizationDetails.description,
      }),
    )
    expect(await screen.findByText('Alterações salvas com sucesso.')).toBeInTheDocument()
  })

  it('não exibe o formulário para o voluntário', async () => {
    setupApi(volunteerPermissions)
    renderWithProviders(<OrganizationSettingsPage />)

    expect(await screen.findByRole('heading', { name: 'Dados da ONG' })).toBeInTheDocument()
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/me/permissions', undefined))
    expect(screen.queryByRole('button', { name: /salvar alterações/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome de exibição')).not.toBeInTheDocument()
  })
})
