import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { SavedSearchesPage } from './SavedSearchesPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

const savedSearch = {
  id: '1',
  name: 'Gatos pequenos',
  criteria: { species: 'Gato', size: ['Pequeno'] },
  active: false,
  createdAt: '2026-10-01T12:00:00.000Z',
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function setup() {
  return renderWithProviders(
    <>
      <SavedSearchesPage />
      <LocationProbe />
    </>,
    { route: '/minhas-buscas' },
  )
}

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ data: [savedSearch], total: 1 })
  mocks.patch
    .mockReset()
    .mockImplementation((_path, changes) => Promise.resolve({ ...savedSearch, ...changes }))
  mocks.delete.mockReset().mockResolvedValue(undefined)
})

describe('SavedSearchesPage', () => {
  it('aplica os critérios salvos à URL de busca', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Gatos pequenos' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Aplicar' }))

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/pets?species=Gato&size=Pequeno'),
    )
  })

  it('permite renomear, alternar alerta e excluir pela API', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByRole('heading', { name: 'Gatos pequenos' })

    await user.click(screen.getByRole('button', { name: 'Renomear' }))
    const nameInput = screen.getByRole('textbox', { name: 'Nome da busca' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Gatos para apartamento')
    await user.click(screen.getByRole('button', { name: 'Salvar nome' }))

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/me/saved-filters/1', {
        name: 'Gatos para apartamento',
      }),
    )
    expect(await screen.findByText('Nome da busca atualizado.')).toHaveAttribute('role', 'status')

    await user.click(screen.getByRole('button', { name: 'Ativar alerta' }))
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/me/saved-filters/1', { active: true }),
    )

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('/me/saved-filters/1'))
  })

  it('mostra erro de carregamento e oferece nova tentativa', async () => {
    mocks.get.mockRejectedValueOnce(new Error('API indisponível'))
    setup()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar suas buscas',
    )
    expect(screen.getByText('API indisponível')).toBeInTheDocument()
  })
})
