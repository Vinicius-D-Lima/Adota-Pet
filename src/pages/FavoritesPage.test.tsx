import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/ApiError'
import { fakeFavoritesApi } from '../test/fakeFavoritesApi'
import { renderWithProviders } from '../test/renderWithProviders'
import { FavoritesPage } from './FavoritesPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FavoritesPage', () => {
  it('lista os pets favoritados', async () => {
    fakeFavoritesApi(mocks, { initial: ['luna', 'mimi'] })
    renderWithProviders(<FavoritesPage />, { route: '/favoritos' })

    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mimi' })).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith('/me/favorites', expect.anything())
  })

  it('mostra o estado vazio com link para /pets', async () => {
    fakeFavoritesApi(mocks)
    renderWithProviders(<FavoritesPage />, { route: '/favoritos' })

    expect(await screen.findByText('Você ainda não favoritou nenhum pet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /encontrar um pet/i })).toHaveAttribute('href', '/pets')
  })

  it('desfavoritar tira o pet da lista na hora', async () => {
    const server = fakeFavoritesApi(mocks, { initial: ['luna'], writeDelayMs: 200 })
    renderWithProviders(<FavoritesPage />, { route: '/favoritos' })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /remover luna/i }))

    expect(screen.queryByRole('heading', { name: 'Luna' })).not.toBeInTheDocument()
    expect(await screen.findByText('Você ainda não favoritou nenhum pet')).toBeInTheDocument()
    expect(server.ids.has('luna')).toBe(true)
    await waitFor(() => expect(server.ids.has('luna')).toBe(false))
  })

  it('mostra erro com opção de tentar novamente', async () => {
    mocks.get.mockRejectedValue(ApiError.network())
    renderWithProviders(<FavoritesPage />, { route: '/favoritos' })

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })
})
