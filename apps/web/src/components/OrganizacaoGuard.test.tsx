import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { adminPermissions } from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { OrganizacaoGuard } from './OrganizacaoGuard'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const getMock = vi.mocked(api.get)

const routes = (
  <Routes>
    <Route
      path="/organizacao"
      element={
        <OrganizacaoGuard>
          <p>Área da organização</p>
        </OrganizacaoGuard>
      }
    />
    <Route path="/" element={<p>Tela inicial</p>} />
    <Route path="/entrar" element={<p>Tela de login</p>} />
  </Routes>
)

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('OrganizacaoGuard', () => {
  it('redireciona para a home quem não pertence a uma organização', async () => {
    getMock.mockRejectedValue(new ApiError(403, 'Área exclusiva para instituições'))
    renderWithProviders(routes, { route: '/organizacao' })

    expect(await screen.findByText('Tela inicial')).toBeInTheDocument()
    expect(screen.queryByText('Área da organização')).not.toBeInTheDocument()
  })

  it('manda para o login quem não está autenticado', async () => {
    vi.stubEnv('VITE_DEMO_USER_ID', 'demo-empty')
    renderWithProviders(routes, { route: '/organizacao' })

    expect(await screen.findByText('Tela de login')).toBeInTheDocument()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('mostra erro com nova tentativa quando a verificação falha por rede', async () => {
    getMock.mockRejectedValue(ApiError.network())
    renderWithProviders(routes, { route: '/organizacao' })

    expect(
      await screen.findByText('Não foi possível verificar suas permissões.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('renderiza a área quando a pessoa é membro da organização', async () => {
    getMock.mockResolvedValue(adminPermissions)
    renderWithProviders(routes, { route: '/organizacao' })

    expect(await screen.findByText('Área da organização')).toBeInTheDocument()
  })
})
