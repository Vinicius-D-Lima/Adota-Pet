import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import { PetCard } from './PetCard'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  access: { hasAccount: false },
}))
vi.mock('../lib/api', () => ({
  api: { get: mocks.get, put: mocks.put, delete: mocks.remove },
}))
vi.mock('../lib/demoAccount', () => ({
  hasDemoAccount: () => mocks.access.hasAccount,
}))

function CurrentPath() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({ data: [], total: 0 })
  mocks.access.hasAccount = false
})

describe('PetCard para visitante sem conta', () => {
  it('envia Favoritar e Conhecer para a página de criação de conta', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <PetCard pet={petFixture} />
        <CurrentPath />
      </>,
      { route: '/pets' },
    )

    expect(screen.getByRole('link', { name: `Conhecer ${petFixture.name}` })).toHaveAttribute(
      'href',
      '/criar-conta',
    )

    await user.click(screen.getByRole('button', { name: `Favoritar ${petFixture.name}` }))
    expect(screen.getByTestId('current-path')).toHaveTextContent('/criar-conta')
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('permite conhecer e favoritar com conta, mesmo sem perfil completo', async () => {
    mocks.access.hasAccount = true
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <PetCard pet={petFixture} />
        <CurrentPath />
      </>,
      { route: '/pets' },
    )

    expect(screen.getByRole('link', { name: `Conhecer ${petFixture.name}` })).toHaveAttribute(
      'href',
      `/pets/${petFixture.id}`,
    )
    await user.click(screen.getByRole('button', { name: `Favoritar ${petFixture.name}` }))
    expect(screen.getByTestId('current-path')).toHaveTextContent('/pets')
    expect(mocks.put).toHaveBeenCalledWith(`/me/favorites/${petFixture.id}`)
  })
})
