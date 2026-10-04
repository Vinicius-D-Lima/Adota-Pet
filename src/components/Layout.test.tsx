import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeFavoritesApi } from '../test/fakeFavoritesApi'
import { renderWithProviders } from '../test/renderWithProviders'
import { useFavorite } from '../hooks/useFavorites'
import { Layout } from './Layout'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

function ToggleMimi() {
  const { toggle } = useFavorite('mimi')
  return <button onClick={toggle}>alternar mimi</button>
}

const favoritesLink = () => screen.getByRole('link', { name: /favoritos/i })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Layout - contador de favoritos', () => {
  it('mostra o total de ids favoritados no item Favoritos', async () => {
    fakeFavoritesApi(mocks, { initial: ['luna', 'mimi'] })
    renderWithProviders(
      <Layout profileName="" requestCount={0}>
        <p>conteúdo</p>
      </Layout>,
    )

    await waitFor(() => expect(favoritesLink()).toHaveTextContent('2'))
    expect(favoritesLink()).toHaveAttribute('href', '/favoritos')
  })

  it('atualiza o contador sem recarregar quando um pet é favoritado', async () => {
    fakeFavoritesApi(mocks, { initial: ['luna'] })
    renderWithProviders(
      <Layout profileName="" requestCount={0}>
        <ToggleMimi />
      </Layout>,
    )
    await waitFor(() => expect(favoritesLink()).toHaveTextContent('1'))

    await userEvent.setup().click(screen.getByRole('button', { name: 'alternar mimi' }))

    await waitFor(() => expect(favoritesLink()).toHaveTextContent('2'))
  })

  it('não mostra contador quando não há favoritos', async () => {
    fakeFavoritesApi(mocks)
    renderWithProviders(
      <Layout profileName="" requestCount={0}>
        <p>conteúdo</p>
      </Layout>,
    )

    await waitFor(() => expect(mocks.get).toHaveBeenCalled())
    expect(favoritesLink()).toHaveTextContent(/^Favoritos$/)
  })
})
