import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { petFixtures } from '../test/fixtures/pets'
import { renderWithProviders } from '../test/renderWithProviders'
import { PetsPage } from './PetsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ api: { get: mocks.get } }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

beforeEach(() => {
  mocks.get.mockReset()
  mocks.get.mockImplementation((path, options) => {
    if (path === '/me/favorites/ids') return Promise.resolve({ data: [], total: 0 })
    const page = Number(options?.query?.page ?? 1)
    const start = (page - 1) * 4
    return Promise.resolve({ data: petFixtures.slice(start, start + 4), total: petFixtures.length })
  })
})

const lastPetsCall = () => mocks.get.mock.calls.filter(([path]) => path === '/pets').slice(-1)[0]

const setup = (route = '/pets') =>
  renderWithProviders(
    <>
      <PetsPage />
      <LocationProbe />
    </>,
    { route },
  )

describe('PetsPage - consulta e filtros', () => {
  it('renderiza os pets retornados pela API e carrega a próxima página', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(await screen.findByRole('heading', { name: 'Tobias' })).toBeInTheDocument()
    expect(lastPetsCall()?.[1]).toMatchObject({ query: { page: 2, limit: 4 } })
  })

  it('inicializa os filtros a partir da URL sem enviar filtros "Todos"', async () => {
    setup('/pets?species=Gato')
    expect(screen.getByLabelText('Filtrar por espécie')).toHaveValue('Gato')
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())
    expect(mocks.get.mock.calls[0][1].query).toMatchObject({ species: 'Gato' })
    expect(mocks.get.mock.calls[0][1].query).not.toHaveProperty('city')
    expect(mocks.get.mock.calls[0][1].query).not.toHaveProperty('lat')
    expect(mocks.get.mock.calls[0][1].query).not.toHaveProperty('lng')
  })

  it('reflete o filtro na URL e faz nova consulta', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Luna' })
    await userEvent.setup().selectOptions(screen.getByLabelText('Filtrar por porte'), 'Médio')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('size=M%C3%A9dio'))
    await waitFor(() => expect(lastPetsCall()?.[1]).toMatchObject({ query: { size: 'Médio' } }))
  })
})
