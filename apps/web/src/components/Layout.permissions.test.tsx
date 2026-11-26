import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSelectedOrganizationId } from '../hooks/useOrganizations'
import { api } from '../lib/api'
import { adminPermissions, volunteerPermissions } from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { Layout } from './Layout'

vi.mock('../hooks/useAdoptionRequests', () => ({
  useAdoptionRequests: () => ({ data: [] }),
}))
vi.mock('../hooks/useFavorites', () => ({
  useFavoriteIds: () => ({ data: [] }),
}))
vi.mock('./FavoriteNotice', () => ({ FavoriteNotice: () => null }))
vi.mock('./NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)

function setupApi(permissions: typeof adminPermissions) {
  getMock.mockImplementation((path: string) => {
    if (String(path).startsWith('/me/permissions')) return Promise.resolve(permissions)
    if (String(path) === '/me/organizations') {
      return Promise.resolve({ data: permissions.organizations ?? [], total: 0 })
    }
    return Promise.resolve({ data: [], total: 0 })
  })
}

const sidebar = () => screen.getByRole('complementary', { name: 'Menu da organização' })

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('Layout - menu da organização', () => {
  it('não mostra Membros nem Dados da ONG para o voluntário', async () => {
    setupApi(volunteerPermissions)
    renderWithProviders(
      <Layout profileName="Instituto Patinhas">
        <p>conteúdo</p>
      </Layout>,
      { route: '/organizacao' },
    )

    const menu = await screen.findByRole('complementary', { name: 'Menu da organização' })
    expect(within(menu).getByRole('link', { name: /painel/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /solicitações/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /pets/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /adoções/i })).toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: /membros/i })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: /convites/i })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: /dados da ong/i })).not.toBeInTheDocument()
  })

  it('mostra os links de gestão para o administrador', async () => {
    setupApi(adminPermissions)
    renderWithProviders(
      <Layout profileName="Instituto Patinhas">
        <p>conteúdo</p>
      </Layout>,
      { route: '/organizacao' },
    )

    await screen.findByRole('complementary', { name: 'Menu da organização' })
    expect(within(sidebar()).getByRole('link', { name: /membros/i })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('link', { name: /convites/i })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('link', { name: /dados da ong/i })).toBeInTheDocument()
  })

  it('troca a organização ativa e recarrega o contexto da área', async () => {
    setupApi(adminPermissions)
    const user = userEvent.setup()
    renderWithProviders(
      <Layout profileName="Instituto Patinhas">
        <p>conteúdo</p>
      </Layout>,
      { route: '/organizacao' },
    )

    const selector = await screen.findByRole('combobox', { name: 'Organização ativa' })
    await waitFor(() => expect(selector).toHaveValue('demo-organization'))

    await user.selectOptions(selector, 'lar-animal')

    expect(getSelectedOrganizationId()).toBe('lar-animal')
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('/me/permissions', {
        query: { organizationId: 'lar-animal' },
      }),
    )
    expect(getMock).toHaveBeenCalledWith('/me/received-requests?organizationId=lar-animal')
  })
})
