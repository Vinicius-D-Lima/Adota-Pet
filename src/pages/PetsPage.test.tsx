import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validProfile } from '../test/fixtures/profile'
import { petFixtures } from '../test/fixtures/pets'
import { renderWithProviders } from '../test/renderWithProviders'
import { ApiError } from '../lib/ApiError'
import { PetsPage } from './PetsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function HistoryControls() {
  const navigate = useNavigate()
  return (
    <div>
      <button onClick={() => navigate(-1)}>Voltar</button>
      <button onClick={() => navigate(1)}>Avançar</button>
    </div>
  )
}

let profileResponse: Record<string, unknown>

beforeEach(() => {
  localStorage.removeItem('saved-searches')
  profileResponse = { ...validProfile, isComplete: true, missingFields: [] }
  mocks.get.mockReset()
  mocks.get.mockImplementation((path, options) => {
    if (path === '/me/favorites/ids') return Promise.resolve({ data: [], total: 0 })
    if (path === '/me/adopter-profile') return Promise.resolve(profileResponse)
    if (path === '/me/saved-filters') return Promise.resolve({ data: [], total: 0 })
    const page = Number(options?.query?.page ?? 1)
    const start = (page - 1) * 4
    return Promise.resolve({ data: petFixtures.slice(start, start + 4), total: petFixtures.length })
  })
  mocks.post.mockReset().mockImplementation((_path, body) =>
    Promise.resolve({
      ...body,
      id: 'saved-filter-1',
      active: false,
      createdAt: '2026-10-01T12:00:00.000Z',
    }),
  )
  mocks.patch.mockReset()
  mocks.delete.mockReset()
})

const lastPetsCall = () => mocks.get.mock.calls.filter(([path]) => path === '/pets').slice(-1)[0]

const setup = (route = '/pets') =>
  renderWithProviders(
    <>
      <PetsPage />
      <LocationProbe />
      <HistoryControls />
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

  it('salva os filtros ativos para consultar depois', async () => {
    setup('/pets?species=Gato&size=Pequeno&sex=F%C3%AAmea&sort=name')
    await screen.findByRole('heading', { name: 'Luna' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Salvar busca' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Nome da busca')).toHaveValue('Gato · Pequeno · Fêmea')
    expect(within(dialog).getByLabelText('Nome da busca')).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Salvar busca' }))

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/me/saved-filters', {
        name: 'Gato · Pequeno · Fêmea',
        criteria: {
          species: 'Gato',
          size: ['Pequeno'],
          sex: 'Fêmea',
        },
        active: false,
      }),
    )
    expect(screen.getByText('Busca salva com sucesso.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exibe claramente o limite 409 retornado pela API', async () => {
    mocks.post.mockRejectedValueOnce(new ApiError(409, 'Limite de filtros atingido'))
    setup('/pets?species=Gato')
    await screen.findByRole('heading', { name: 'Luna' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Salvar busca' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar busca' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você atingiu o limite de 10 buscas salvas.',
    )
  })

  it('reproduz filtros compartilhados e acompanha voltar/avançar do navegador', async () => {
    const user = userEvent.setup()
    setup('/pets?search=Luna&species=Gato&size=Pequeno&sex=F%C3%AAmea')

    expect(screen.getByLabelText('Filtrar por espécie')).toHaveValue('Gato')
    expect(screen.getByLabelText('Filtrar por sexo')).toHaveValue('Fêmea')
    expect(screen.getByRole('button', { name: 'Pequeno' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByPlaceholderText('Busque por nome, raça ou cidade')).toHaveValue('Luna')
    await waitFor(() =>
      expect(lastPetsCall()?.[1]).toMatchObject({
        query: { search: 'Luna', species: 'Gato', size: ['Pequeno'], sex: 'Fêmea' },
      }),
    )

    await user.selectOptions(screen.getByLabelText('Filtrar por espécie'), 'Cachorro')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('species=Cachorro'),
    )
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    await waitFor(() => expect(screen.getByLabelText('Filtrar por espécie')).toHaveValue('Gato'))
    await user.click(screen.getByRole('button', { name: 'Avançar' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Filtrar por espécie')).toHaveValue('Cachorro'),
    )
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
