import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ApiError } from './lib/ApiError'
import { seriousViolations } from './test/axe'
import { makeRequest } from './test/fixtures/requests'
import { validProfile } from './test/fixtures/profile'
import { petFixture } from './test/petFixture'
import { renderWithProviders } from './test/renderWithProviders'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('./lib/api', () => ({ api: mocks }))

const list = <T,>(data: T[]) => ({ data, total: data.length })

const loaded = async (path: string) => {
  if (path === '/pets') return list([petFixture])
  if (path === `/pets/${petFixture.id}`) return petFixture
  // Solicitação de outro pet: a listagem tem o que mostrar e as telas do pet não são bloqueadas.
  if (path === '/me/requests') return list([makeRequest({ id: 'SOL-1042', petId: 'outro-pet' })])
  if (path === '/me/favorites/ids') return list([petFixture.id])
  if (path === '/me/favorites') return list([petFixture])
  if (path === '/me/adopter-profile') return { ...validProfile, isComplete: true }
  throw new ApiError(404, 'não mockado')
}

const neverLoads = () => new Promise<never>(() => {})

beforeEach(() => {
  mocks.get.mockImplementation(loaded)
})

afterEach(() => {
  vi.clearAllMocks()
})

// `ready` só existe depois que os dados chegam; o título da página sozinho aparece durante o carregamento.
const pages: [string, string, RegExp][] = [
  ['Início', '/', /^Luna$/],
  ['Pets', '/pets', /^Luna$/],
  ['Detalhe do pet', `/pets/${petFixture.id}`, /minha história/i],
  ['Compatibilidade', `/pets/${petFixture.id}/compatibilidade`, /pontos que combinam/i],
  ['Questionário', `/pets/${petFixture.id}/questionario`, /questionário de adoção/i],
  ['Solicitações', '/solicitacoes', /SOL-1042/],
  ['Favoritos', '/favoritos', /^Luna$/],
  ['Perfil', '/perfil', /salvar perfil/i],
  ['Página não encontrada', '/rota/inexistente', /voltar ao início/i],
]

describe('acessibilidade (axe): nenhuma violação crítica ou séria', () => {
  it.each(pages)('%s', async (_name, route, ready) => {
    const { container } = renderWithProviders(<App />, { route })

    await waitFor(() => expect(screen.getAllByText(ready).length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByText(/carregando|buscando/i)).not.toBeInTheDocument())

    expect(await seriousViolations(container)).toEqual([])
  })

  it.each([
    ['Início', '/'],
    ['Pets', '/pets'],
    ['Favoritos', '/favoritos'],
    ['Solicitações', '/solicitacoes'],
    ['Perfil', '/perfil'],
  ])('%s, ainda carregando', async (_name, route) => {
    mocks.get.mockImplementation(neverLoads)
    const { container } = renderWithProviders(<App />, { route })

    expect(await seriousViolations(container)).toEqual([])
  })

  it('Solicitações, com o modal de cancelamento aberto', async () => {
    const { container } = renderWithProviders(<App />, { route: '/solicitacoes' })
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await seriousViolations(document.body)).toEqual([])
    expect(container).toHaveAttribute('inert')
  })
})
