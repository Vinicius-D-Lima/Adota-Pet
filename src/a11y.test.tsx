import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

mocks.get.mockImplementation(async (path: string) => {
  if (path === '/pets') return list([petFixture])
  if (path === `/pets/${petFixture.id}`) return petFixture
  if (path === '/me/requests') return list([makeRequest()])
  if (path === '/me/favorites/ids') return list([petFixture.id])
  if (path === '/me/favorites') return list([petFixture])
  if (path === '/me/adopter-profile') return { ...validProfile, isComplete: true }
  throw new ApiError(404, 'não mockado')
})

afterEach(() => {
  vi.clearAllMocks()
})

const pages: [string, string, RegExp][] = [
  ['Início', '/', /encontre um amor/i],
  ['Pets', '/pets', /pets esperando por você/i],
  ['Detalhe do pet', `/pets/${petFixture.id}`, /minha história/i],
  ['Compatibilidade', `/pets/${petFixture.id}/compatibilidade`, /compatibilidade/i],
  ['Questionário', `/pets/${petFixture.id}/questionario`, /questionário de adoção/i],
  ['Solicitações', '/solicitacoes', /minhas solicitações/i],
  ['Favoritos', '/favoritos', /favoritos/i],
  ['Perfil', '/perfil', /perfil do adotante/i],
]

describe('acessibilidade (axe): nenhuma violação crítica ou séria', () => {
  it.each(pages)('%s', async (_name, route, ready) => {
    const { container } = renderWithProviders(<App />, { route })

    await waitFor(() => expect(screen.getAllByText(ready).length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByText(/carregando|buscando/i)).not.toBeInTheDocument())

    expect(await seriousViolations(container)).toEqual([])
  })
})
