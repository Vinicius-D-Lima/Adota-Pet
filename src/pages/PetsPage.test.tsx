import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validProfile } from '../test/fixtures/profile'
import { petFixtures } from '../test/fixtures/pets'
import { renderWithProviders } from '../test/renderWithProviders'
import { PetsPage } from './PetsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ api: { get: mocks.get } }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

let profileResponse: Record<string, unknown>

beforeEach(() => {
  profileResponse = { ...validProfile, isComplete: true, missingFields: [] }
  mocks.get.mockReset()
  mocks.get.mockImplementation((path, options) => {
    if (path === '/me/favorites/ids') return Promise.resolve({ data: [], total: 0 })
    if (path === '/me/adopter-profile') return Promise.resolve(profileResponse)
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
    await waitFor(() => expect(lastPetsCall()).toBeDefined())
    const query = lastPetsCall()?.[1].query
    expect(query).toMatchObject({ species: 'Gato' })
    expect(query).not.toHaveProperty('city')
    expect(query).not.toHaveProperty('lat')
    expect(query).not.toHaveProperty('lng')
  })

  it('reflete o filtro na URL e faz nova consulta', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Luna' })
    await userEvent.setup().selectOptions(screen.getByLabelText('Filtrar por espécie'), 'Gato')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('species=Gato'))
    await waitFor(() => expect(lastPetsCall()?.[1]).toMatchObject({ query: { species: 'Gato' } }))
  })

  it('aceita mais de um porte e reproduz o estado a partir da URL', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByRole('heading', { name: 'Luna' })
    await user.click(screen.getByRole('button', { name: 'Pequeno' }))
    await user.click(screen.getByRole('button', { name: 'Médio' }))
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('size=Pequeno&size=M%C3%A9dio'),
    )
    await waitFor(() =>
      expect(lastPetsCall()?.[1]).toMatchObject({ query: { size: ['Pequeno', 'Médio'] } }),
    )
    await user.click(screen.getByRole('button', { name: 'Pequeno' }))
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('?size=M%C3%A9dio'),
    )
  })

  it('abre com os portes da URL selecionados', async () => {
    setup('/pets?size=Pequeno&size=M%C3%A9dio')
    expect(screen.getByRole('button', { name: 'Pequeno' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Médio' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Grande' })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())
    expect(lastPetsCall()?.[1]).toMatchObject({ query: { size: ['Pequeno', 'Médio'] } })
  })
})

describe('PetsPage - preferências do perfil', () => {
  const useButton = () => screen.findByRole('button', { name: /Usar minhas preferências/ })

  it('aplica espécie e porte do perfil ("Pequeno ou médio") e Limpar volta ao início', async () => {
    profileResponse = {
      ...profileResponse,
      preferredSpecies: 'Gato',
      preferredSize: 'Pequeno ou médio',
    }
    const user = userEvent.setup()
    setup()
    const button = await useButton()
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        'species=Gato&size=Pequeno&size=M%C3%A9dio',
      ),
    )
    await waitFor(() =>
      expect(lastPetsCall()?.[1]).toMatchObject({
        query: { species: 'Gato', size: ['Pequeno', 'Médio'] },
      }),
    )
    await user.click(screen.getByRole('button', { name: /Limpar/ }))
    await waitFor(() => expect(screen.getByTestId('location')).toBeEmptyDOMElement())
  })

  it('"Médio ou grande" vira Médio + Grande e "Sem preferência" não filtra a espécie', async () => {
    profileResponse = {
      ...profileResponse,
      preferredSpecies: 'Sem preferência',
      preferredSize: 'Médio ou grande',
    }
    const user = userEvent.setup()
    setup()
    const button = await useButton()
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('?size=M%C3%A9dio&size=Grande'),
    )
    expect(screen.getByTestId('location')).not.toHaveTextContent('species')
  })

  it('fica desabilitado, com explicação, quando o perfil não tem preferências', async () => {
    profileResponse = { ...profileResponse, preferredSpecies: '', preferredSize: '' }
    setup()
    const button = await useButton()
    await waitFor(() =>
      expect(screen.getByText(/Informe espécie ou porte de preferência/)).toBeInTheDocument(),
    )
    expect(button).toBeDisabled()
  })

  it('fica desabilitado com "Sem preferência" nos dois campos', async () => {
    profileResponse = {
      ...profileResponse,
      preferredSpecies: 'Sem preferência',
      preferredSize: 'Sem preferência',
    }
    setup()
    const button = await useButton()
    await waitFor(() => expect(screen.getByText(/Informe espécie ou porte/)).toBeInTheDocument())
    expect(button).toBeDisabled()
  })
})
