import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { validProfile } from '../test/fixtures/profile'
import { renderWithProviders } from '../test/renderWithProviders'
import { ProfilePage } from './ProfilePage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const putMock = vi.mocked(api.put)

const savedResponse = { ...validProfile, userId: 'demo', isComplete: true, missingFields: [] }

async function setup(response: object = savedResponse) {
  getMock.mockResolvedValue(response)
  renderWithProviders(<ProfilePage />, { route: '/perfil' })
  await screen.findByRole('heading', { name: /perfil do adotante/i })
  return userEvent.setup()
}

const saveButton = () => screen.getByRole('button', { name: /salvar perfil|salvando/i })
const nameInput = () => screen.getByRole('textbox', { name: /nome completo/i })
const emailInput = () => screen.getByRole('textbox', { name: /e-mail/i })

beforeEach(() => {
  window.scrollTo = vi.fn()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ProfilePage', () => {
  it('carrega o perfil salvo no formulário', async () => {
    await setup()
    expect(getMock).toHaveBeenCalledWith('/me/adopter-profile')
    expect(nameInput()).toHaveValue(validProfile.name)
    expect(screen.getByRole('textbox', { name: /cpf/i })).toHaveValue(validProfile.cpf)
  })

  it('lê TODOS os campos do perfil devolvidos pela API', async () => {
    await setup()

    const textFields: Array<[RegExp, string]> = [
      [/nome completo/i, validProfile.name],
      [/cpf/i, validProfile.cpf],
      [/data de nascimento/i, validProfile.birthDate],
      [/e-mail/i, validProfile.email],
      [/telefone\/celular/i, validProfile.phone],
      [/cep/i, validProfile.zipCode],
      [/endereço/i, validProfile.address],
    ]
    for (const [label, value] of textFields) {
      expect(screen.getByLabelText(label), String(label)).toHaveValue(value)
    }

    const selectFields: Array<[RegExp, string]> = [
      [/tipo de moradia/i, validProfile.housing],
      [/área externa segura/i, String(validProfile.hasOutdoorArea)],
      [/há crianças na residência/i, String(validProfile.hasChildren)],
      [/já há outros pets/i, String(validProfile.hasOtherPets)],
      [/tempo disponível por dia/i, validProfile.dailyTime],
      [/nível de atividade/i, validProfile.activityLevel],
      [/experiência com animais/i, validProfile.experience],
      [/disponibilidade para cuidados especiais/i, String(validProfile.acceptsSpecialCare)],
      [/espécie/i, validProfile.preferredSpecies],
      [/porte/i, validProfile.preferredSize],
    ]
    for (const [label, value] of selectFields) {
      expect(screen.getByLabelText(label), String(label)).toHaveValue(value)
    }
  })

  it('ignora a tentativa de trocar o tipo do perfil pela URL', async () => {
    getMock.mockResolvedValue(savedResponse)
    renderWithProviders(<ProfilePage />, { route: '/perfil?tipo=responsavel' })

    expect(await screen.findByRole('heading', { name: /perfil do adotante/i })).toBeInTheDocument()
    expect(screen.queryByText(/como você quer usar o adotapet/i)).not.toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('/me/adopter-profile')
  })

  it('mostra "Salvando…" com o botão desabilitado e só confirma após o 200', async () => {
    let resolvePut: (value: unknown) => void = () => {}
    putMock.mockReturnValue(new Promise((resolve) => (resolvePut = resolve)))
    const user = await setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Maria Souza')
    await user.click(saveButton())

    expect(saveButton()).toHaveTextContent('Salvando…')
    expect(saveButton()).toBeDisabled()
    expect(screen.queryByText(/perfil atualizado/i)).not.toBeInTheDocument()
    expect(putMock).toHaveBeenCalledWith('/me/adopter-profile', {
      ...validProfile,
      name: 'Maria Souza',
    })

    resolvePut({ ...savedResponse, name: 'Maria Souza' })

    expect(await screen.findByText(/perfil atualizado/i)).toBeInTheDocument()
    expect(saveButton()).toHaveTextContent('Salvar perfil')
    expect(saveButton()).toBeEnabled()
  })

  it('não envia a requisição quando o Zod recusa um campo', async () => {
    const user = await setup()

    await user.clear(emailInput())
    await user.type(emailInput(), 'email-invalido')
    await user.click(saveButton())

    expect(putMock).not.toHaveBeenCalled()
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument()
  })

  it('mapeia o 400 do servidor para o campo certo', async () => {
    putMock.mockRejectedValue(
      new ApiError(400, 'Validação falhou', [{ field: 'email', message: 'E-mail já cadastrado.' }]),
    )
    const user = await setup()

    await user.click(saveButton())

    expect(await screen.findByText('E-mail já cadastrado.')).toBeInTheDocument()
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput()).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByText(/perfil atualizado/i)).not.toBeInTheDocument()
  })

  it('mantém o rascunho e mostra mensagem amigável em falha de rede', async () => {
    putMock.mockRejectedValue(ApiError.network())
    const user = await setup()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Maria Souza')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Seus dados foram mantidos.',
    )
    expect(nameInput()).toHaveValue('Maria Souza')
    expect(screen.queryByText(/perfil atualizado/i)).not.toBeInTheDocument()
  })

  it('avisa quando o perfil salvo está incompleto, listando os campos', async () => {
    await setup({
      ...savedResponse,
      housing: undefined,
      isComplete: false,
      missingFields: ['housing'],
    })

    expect(screen.getByText(/seu perfil salvo está incompleto/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tipo de moradia')
  })

  it('remove o aviso de incompleto depois de salvar um perfil completo', async () => {
    putMock.mockResolvedValue(savedResponse)
    const user = await setup({
      ...savedResponse,
      housing: undefined,
      isComplete: false,
      missingFields: ['housing'],
    })

    expect(screen.getByText(/seu perfil salvo está incompleto/i)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Tipo de moradia'), 'Casa')
    await user.click(saveButton())

    await waitFor(() =>
      expect(screen.queryByText(/seu perfil salvo está incompleto/i)).not.toBeInTheDocument(),
    )
  })
})
