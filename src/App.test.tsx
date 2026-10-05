import { screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { api } from './lib/api'
import { ApiError } from './lib/ApiError'
import { renderWithProviders } from './test/renderWithProviders'

vi.mock('./lib/api', () => ({ api: { get: vi.fn() } }))

const getMock = vi.mocked(api.get)

function Pathname() {
  return <output data-testid="pathname">{useLocation().pathname}</output>
}

function setup(route: string) {
  renderWithProviders(
    <>
      <App />
      <Pathname />
    </>,
    { route },
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('mostra a página 404 para uma URL inexistente sem alterar o endereço', async () => {
    getMock.mockRejectedValue(new ApiError(500, 'indisponível'))
    setup('/rota/que-nao-existe')

    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(screen.getByTestId('pathname')).toHaveTextContent('/rota/que-nao-existe')
  })

  it('mostra "Pet não encontrado" para um pet inexistente', async () => {
    getMock.mockImplementation((path: string) =>
      path === '/pets/id-que-nao-existe'
        ? Promise.reject(new ApiError(404, 'Pet não encontrado'))
        : Promise.reject(new ApiError(500, 'indisponível')),
    )
    setup('/pets/id-que-nao-existe')

    expect(await screen.findByRole('heading', { name: 'Pet não encontrado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver outros pets' })).toHaveAttribute('href', '/pets')
    expect(screen.getByTestId('pathname')).toHaveTextContent('/pets/id-que-nao-existe')
  })
})
