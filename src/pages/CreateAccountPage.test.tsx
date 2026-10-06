import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { CreateAccountPage } from './CreateAccountPage'

const mocks = vi.hoisted(() => ({ createDemoAccount: vi.fn(), put: vi.fn() }))
vi.mock('../lib/demoAccount', () => ({ createDemoAccount: mocks.createDemoAccount }))
vi.mock('../lib/api', () => ({ api: { put: mocks.put } }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.put.mockResolvedValue({ id: 'demo-empty' })
})

function CurrentPath() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

describe('CreateAccountPage', () => {
  it('cria uma conta de instituição com os campos específicos e volta ao início', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <CreateAccountPage />
        <CurrentPath />
      </>,
      { route: '/criar-conta' },
    )

    await user.click(screen.getByRole('radio', { name: /Quero divulgar pets/ }))
    await user.type(screen.getByLabelText('Nome da instituição'), 'Instituto Patinhas')
    await user.type(screen.getByLabelText('Nome do responsável'), 'Maria da Silva')
    await user.type(screen.getByLabelText('CNPJ'), '11222333000181')
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.type(screen.getByLabelText('Estado'), 'SP')
    await user.type(screen.getByLabelText('E-mail'), 'contato@patinhas.org')
    await user.type(screen.getByLabelText('Celular'), '11999999999')
    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.type(screen.getByLabelText('Endereço completo'), 'Avenida Paulista, 1000')
    await user.type(screen.getByPlaceholderText('Crie uma senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: /Criar minha conta/ }))

    const personalData = {
      organizationName: 'Instituto Patinhas',
      responsibleName: 'Maria da Silva',
      document: '11222333000181',
      email: 'contato@patinhas.org',
      phone: '11999999999',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310100',
      address: 'Avenida Paulista, 1000',
    }
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith('/me/account', {
        ...personalData,
        password: 'senha123',
        accountType: 'guardian',
      }),
    )
    expect(mocks.createDemoAccount).toHaveBeenCalledWith(
      '/perfil?tipo=responsavel',
      personalData,
    )
    expect(screen.getByTestId('current-path')).toHaveTextContent('/')
  })

  it('valida os dados básicos do adotante antes de criar a conta', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateAccountPage />)

    await user.click(screen.getByRole('button', { name: /Criar minha conta/ }))

    expect(await screen.findByText('Informe seu nome completo.')).toBeInTheDocument()
    expect(mocks.put).not.toHaveBeenCalled()
    expect(mocks.createDemoAccount).not.toHaveBeenCalled()
  })
})
