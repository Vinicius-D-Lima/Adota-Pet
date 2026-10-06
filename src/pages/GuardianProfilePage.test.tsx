import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { renderWithProviders } from '../test/renderWithProviders'
import { ProfilePage } from './ProfilePage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../lib/demoAccount', () => ({
  getDemoProfilePath: () => '/perfil?tipo=responsavel',
  getDemoPersonalData: () => null,
  completeDemoProfile: vi.fn(),
}))

describe('perfil responsável', () => {
  it('abre diretamente o perfil de responsável definido pela conta', async () => {
    vi.mocked(api.get).mockResolvedValue({ isComplete: false, missingFields: [] })
    renderWithProviders(<ProfilePage />, { route: '/perfil' })

    expect(
      await screen.findByRole('heading', { name: /quem coloca pets para adoção/i }),
    ).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/me/guardian-profile')
    expect(screen.queryByText(/como você quer usar o adotapet/i)).not.toBeInTheDocument()
  })

  it('adapta os campos para instituição ou protetor independente', async () => {
    vi.mocked(api.get).mockResolvedValue({ isComplete: false, missingFields: [] })
    renderWithProviders(<ProfilePage />, { route: '/perfil' })
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: /quem coloca pets para adoção/i })
    await user.click(screen.getByRole('radio', { name: /instituição ou ong/i }))
    expect(screen.getByRole('textbox', { name: /razão social/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^cnpj$/i })).toHaveAttribute('maxlength', '14')

    await user.click(screen.getByRole('radio', { name: /protetor independente/i }))
    expect(screen.queryByRole('textbox', { name: /nome público/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /nome completo/i })).toHaveAttribute(
      'placeholder',
      'Ex.: Ana Maria de Souza',
    )
    expect(screen.getByRole('textbox', { name: /^cpf$/i })).toHaveAttribute('maxlength', '11')
    expect(screen.getByRole('textbox', { name: /telefone/i })).toHaveAttribute(
      'placeholder',
      'Ex.: 11999999999',
    )
  })
})
