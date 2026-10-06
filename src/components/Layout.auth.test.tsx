import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { Layout } from './Layout'

vi.mock('../hooks/useAdoptionRequests', () => ({
  useAdoptionRequests: () => ({ data: [] }),
}))
vi.mock('../hooks/useFavorites', () => ({
  useFavoriteIds: () => ({ data: [] }),
}))
vi.mock('./FavoriteNotice', () => ({ FavoriteNotice: () => null }))

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

describe('Layout - sessão e menu do perfil', () => {
  it('abre o dropdown e encerra a sessão sem recarregar a página', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Layout profileName="Lucas de Paula">
        <p>Conteúdo</p>
      </Layout>,
    )

    await user.click(screen.getByRole('button', { name: /olá.*bem-vindo lucas/i }))
    expect(screen.getByRole('menuitem', { name: /visualizar meu perfil/i })).toHaveAttribute(
      'href',
      '/perfil',
    )

    await user.click(screen.getByRole('menuitem', { name: /sair/i }))
    expect(screen.queryByRole('menuitem', { name: /sair/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /entrar ou criar conta/i }).length).toBeGreaterThan(
      0,
    )
  })
})
