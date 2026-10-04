import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FavoriteNotice } from '../components/FavoriteNotice'
import { PetCard } from '../components/PetCard'
import { fakeFavoritesApi } from '../test/fakeFavoritesApi'
import { petFixtures } from '../test/fixtures/pets'
import { renderWithProviders } from '../test/renderWithProviders'
import { clearFavoriteNotice } from './useFavoriteNotice'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

const luna = petFixtures[0]

const heart = () => screen.getByRole('button', { name: /luna/i })

function setup(options: Parameters<typeof fakeFavoritesApi>[1] = {}) {
  const server = fakeFavoritesApi(mocks, options)
  renderWithProviders(
    <>
      <PetCard pet={luna} />
      <FavoriteNotice />
    </>,
  )
  return { server, user: userEvent.setup() }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  clearFavoriteNotice()
})

describe('useFavorite', () => {
  it('reflete os favoritos vindos da API', async () => {
    setup({ initial: ['luna'] })
    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'true'))
    expect(heart()).toHaveAccessibleName('Remover Luna dos favoritos')
  })

  it('atualiza o coração na hora, antes da resposta da API', async () => {
    const { server, user } = setup({ writeDelayMs: 200 })
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    await user.click(heart())

    expect(heart()).toHaveAttribute('aria-pressed', 'true')
    expect(server.ids.has('luna')).toBe(false)
    await waitFor(() => expect(server.ids.has('luna')).toBe(true))
    expect(mocks.put).toHaveBeenCalledWith('/me/favorites/luna')
  })

  it('desfaz o coração e avisa quando a API falha', async () => {
    const { server, user } = setup({ initial: ['luna'] })
    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'true'))
    server.failWrites = true

    await user.click(heart())

    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Não foi possível remover o pet dos favoritos.',
    )
    expect(server.ids.has('luna')).toBe(true)
  })

  it('avisa ao falhar ao favoritar e volta ao estado anterior', async () => {
    const { server, user } = setup()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())
    server.failWrites = true

    await user.click(heart())

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/favoritar o pet/))
    expect(heart()).toHaveAttribute('aria-pressed', 'false')
  })

  it.each([
    [3, true],
    [4, false],
    [7, true],
  ])('termina no estado certo depois de %i cliques rápidos', async (clicks, expected) => {
    const { server, user } = setup({ writeDelayMs: 15 })
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    for (let i = 0; i < clicks; i += 1) await user.click(heart())

    await waitFor(() => expect(server.writes).toHaveLength(clicks))
    // As escritas chegam em ordem, alternando PUT/DELETE.
    expect(server.writes).toEqual(
      Array.from({ length: clicks }, (_, i) => `${i % 2 === 0 ? 'PUT' : 'DELETE'} luna`),
    )
    expect(server.ids.has('luna')).toBe(expected)
    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', String(expected)))
    // Depois da ressincronização a tela ainda bate com o "servidor".
    await waitFor(() => expect(mocks.get.mock.calls.length).toBeGreaterThan(1))
    expect(heart()).toHaveAttribute('aria-pressed', String(expected))
  })
})
