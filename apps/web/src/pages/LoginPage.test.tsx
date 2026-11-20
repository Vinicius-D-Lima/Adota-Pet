import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/ApiError'
import { renderWithProviders } from '../test/renderWithProviders'
import { LoginPage } from './LoginPage'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}))

vi.mock('../hooks/useDemoAccount', () => ({
  useDemoAccount: () => ({
    isAuthenticated: false,
    status: 'anonymous',
    profilePath: '/perfil',
    login: mocks.login,
    logout: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.login.mockResolvedValue(undefined)
})

function CurrentPath() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

describe('LoginPage', () => {
  it('renderiza os campos e exibe link para cadastro', () => {
    renderWithProviders(<LoginPage />, { route: '/entrar' })

    expect(screen.getByRole('heading', { name: /entrar no adotapet/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()

    const registerLink = screen.getByRole('link', { name: /^criar$/i })
    expect(registerLink).toBeInTheDocument()
    expect(registerLink).toHaveAttribute('href', '/cadastro')
  })

  it('exibe mensagens de validação ao submeter formulário em branco', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />, { route: '/entrar' })

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('envia e-mail e senha e redireciona', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <LoginPage />
        <CurrentPath />
      </>,
      { route: '/entrar' },
    )

    await user.type(screen.getByLabelText(/e-mail/i), 'lucas@exemplo.com')
    await user.type(screen.getByLabelText(/senha/i), 'Senha@123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith({
        accountType: 'adopter',
        email: 'lucas@exemplo.com',
        password: 'Senha@123',
      })
    })
  })

  it('permite alternar para instituição e realizar login', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <LoginPage />
        <CurrentPath />
      </>,
      { route: '/entrar' },
    )

    await user.click(screen.getByRole('button', { name: /instituição \/ protetor/i }))
    await user.type(screen.getByLabelText(/e-mail/i), 'ong@patinhas.org')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith({
        accountType: 'guardian',
        email: 'ong@patinhas.org',
        password: 'senha123',
      })
    })
  })

  it('mostra a mensagem genérica do backend em credenciais inválidas', async () => {
    mocks.login.mockRejectedValueOnce(new ApiError(401, 'Credenciais inválidas'))
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />, { route: '/entrar' })

    await user.type(screen.getByLabelText(/e-mail/i), 'lucas@exemplo.com')
    await user.type(screen.getByLabelText(/senha/i), 'Senha@123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Credenciais inválidas')).toBeInTheDocument()
  })

  it('mostra erros de campo vindos do backend', async () => {
    mocks.login.mockRejectedValueOnce(
      new ApiError(400, 'Validação falhou', [{ field: 'password', message: 'Senha muito curta' }]),
    )
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />, { route: '/entrar' })

    await user.type(screen.getByLabelText(/e-mail/i), 'lucas@exemplo.com')
    await user.type(screen.getByLabelText(/senha/i), 'Senha@123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Senha muito curta')).toBeInTheDocument()
  })
})
