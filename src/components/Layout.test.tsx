import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeFavoritesApi } from '../test/fakeFavoritesApi'
import { makeRequest } from '../test/fixtures/requests'
import { renderWithProviders } from '../test/renderWithProviders'
import { useFavorite } from '../hooks/useFavorites'
import type { AdoptionRequest } from '../types'
import { Layout } from './Layout'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

function ToggleMimi() {
  const { toggle } = useFavorite('mimi')
  return <button onClick={toggle}>alternar mimi</button>
}

const favoritesLink = () => screen.getByRole('link', { name: /favoritos/i })
const requestsLink = () => screen.getByRole('link', { name: /minhas solicitações/i })

/** O Layout lê favoritos e solicitações; o fake de favoritos não conhece /me/requests. */
function setupApi({
  favorites = [],
  requests = [],
}: { favorites?: string[]; requests?: AdoptionRequest[] } = {}) {
  fakeFavoritesApi(mocks, { initial: favorites })
  const favoritesGet = mocks.get.getMockImplementation()
  mocks.get.mockImplementation((path: string) =>
    path === '/me/requests'
      ? Promise.resolve({ data: requests, total: requests.length })
      : favoritesGet?.(path),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Layout - contador de favoritos', () => {
  it('mostra o total de ids favoritados no item Favoritos', async () => {
    setupApi({ favorites: ['luna', 'mimi'] })
    renderWithProviders(
      <Layout profileName="">
        <p>conteúdo</p>
      </Layout>,
    )

    await waitFor(() => expect(favoritesLink()).toHaveTextContent('2'))
    expect(favoritesLink()).toHaveAttribute('href', '/favoritos')
  })

  it('atualiza o contador sem recarregar quando um pet é favoritado', async () => {
    setupApi({ favorites: ['luna'] })
    renderWithProviders(
      <Layout profileName="">
        <ToggleMimi />
      </Layout>,
    )
    await waitFor(() => expect(favoritesLink()).toHaveTextContent('1'))

    await userEvent.setup().click(screen.getByRole('button', { name: 'alternar mimi' }))

    await waitFor(() => expect(favoritesLink()).toHaveTextContent('2'))
  })

  it('não mostra contador quando não há favoritos', async () => {
    setupApi()
    renderWithProviders(
      <Layout profileName="">
        <p>conteúdo</p>
      </Layout>,
    )

    await waitFor(() => expect(mocks.get).toHaveBeenCalled())
    expect(favoritesLink()).toHaveTextContent(/^Favoritos$/)
  })
})

describe('Layout - contador de solicitações', () => {
  it('conta só as solicitações ativas no item Minhas solicitações', async () => {
    setupApi({
      requests: [
        makeRequest({ id: 'SOL-1', status: 'Enviada' }),
        makeRequest({ id: 'SOL-2', status: 'Em análise' }),
        makeRequest({ id: 'SOL-3', status: 'Cancelada' }),
      ],
    })
    renderWithProviders(
      <Layout profileName="">
        <p>conteúdo</p>
      </Layout>,
    )

    await waitFor(() => expect(requestsLink()).toHaveTextContent('2'))
  })

  it('não mostra contador quando não há solicitações ativas', async () => {
    setupApi({ requests: [makeRequest({ status: 'Cancelada' })] })
    renderWithProviders(
      <Layout profileName="">
        <p>conteúdo</p>
      </Layout>,
    )

    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/me/requests'))
    expect(requestsLink()).toHaveTextContent(/^Minhas solicitações$/)
  })
})
