import { screen } from '@testing-library/react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { adminPermissions, volunteerPermissions } from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { OrganizacaoGuard } from './OrganizacaoGuard'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)

const routes = (
  <Routes>
    <Route
      element={
        <OrganizacaoGuard permission="read" subject="Member">
          <Outlet />
        </OrganizacaoGuard>
      }
    >
      <Route path="/organizacao/membros" element={<p>Página de membros</p>} />
    </Route>
    <Route path="/organizacao" element={<p>Painel da organização</p>} />
    <Route path="/" element={<p>Tela inicial</p>} />
  </Routes>
)

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('OrganizacaoGuard - restrição por papel', () => {
  it('redireciona o voluntário que abre diretamente a URL de membros', async () => {
    getMock.mockResolvedValue(volunteerPermissions)
    renderWithProviders(routes, { route: '/organizacao/membros' })

    expect(await screen.findByText('Painel da organização')).toBeInTheDocument()
    expect(screen.queryByText('Página de membros')).not.toBeInTheDocument()
  })

  it('libera a rota restrita para o administrador', async () => {
    getMock.mockResolvedValue(adminPermissions)
    renderWithProviders(routes, { route: '/organizacao/membros' })

    expect(await screen.findByText('Página de membros')).toBeInTheDocument()
  })
})
