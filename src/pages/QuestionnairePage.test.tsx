import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { makeRequest } from '../test/fixtures/requests'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import { QuestionnairePage } from './QuestionnairePage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const mocks = vi.hoisted(() => ({ usePet: vi.fn() }))
vi.mock('../hooks/usePets', () => ({ usePet: mocks.usePet }))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)

beforeEach(() => {
  mocks.usePet.mockReturnValue({ data: petFixture, isPending: false, isError: false })
})

const longText = 'Texto com mais de vinte caracteres para validar.'
const pet = petFixture

function setup() {
  renderWithProviders(
    <Routes>
      <Route path="/pets/:petId/questionario" element={<QuestionnairePage />} />
      <Route path="/solicitacoes/:id/enviada" element={<p>Solicitação enviada</p>} />
    </Routes>,
    { route: `/pets/${pet.id}/questionario` },
  )
  return userEvent.setup()
}

const submitButton = () => screen.getByRole('button', { name: /revisar e enviar|enviando/i })

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  const [motivation, routine, adaptation] = screen.getAllByRole('textbox')
  await user.type(motivation, longText)
  await user.type(routine, longText)
  await user.type(adaptation, longText)
  await user.click(screen.getByRole('checkbox', { name: /custos recorrentes/i }))
  await user.click(screen.getByRole('checkbox', { name: /compromisso com o bem-estar/i }))
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('QuestionnairePage - validação', () => {
  it('bloqueia o envio e mostra erro com o formulário vazio', async () => {
    const user = setup()
    await user.click(submitButton())
    expect(postMock).not.toHaveBeenCalled()
    expect(screen.getByText(/explique sua motivação usando pelo menos 20/i)).toBeInTheDocument()
    expect(screen.getByText(/descreva sua rotina usando pelo menos 20/i)).toBeInTheDocument()
    expect(
      screen.getByText(/explique como será a adaptação usando pelo menos 15/i),
    ).toBeInTheDocument()
  })

  it('bloqueia o envio quando os compromissos não foram marcados', async () => {
    const user = setup()
    const [motivation, routine, adaptation] = screen.getAllByRole('textbox')
    await user.type(motivation, longText)
    await user.type(routine, longText)
    await user.type(adaptation, longText)
    await user.click(submitButton())
    expect(postMock).not.toHaveBeenCalled()
    expect(
      screen.getByText(/ciente dos custos recorrentes/i, { selector: 'small' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/confirme o compromisso com o bem-estar/i)).toBeInTheDocument()
  })
})

describe('QuestionnairePage - envio', () => {
  it('envia { petId, answers } e navega para a confirmação', async () => {
    postMock.mockResolvedValue(makeRequest({ id: 'SOL-1043', status: 'Enviada' }))
    const user = setup()
    await fillValidForm(user)
    await user.click(submitButton())

    expect(postMock).toHaveBeenCalledWith('/requests', {
      petId: pet.id,
      answers: expect.objectContaining({ costs: true, commitment: true }),
    })
    expect(await screen.findByText('Solicitação enviada')).toBeInTheDocument()
  })

  it('não cria duas solicitações com dois cliques rápidos', async () => {
    postMock.mockReturnValue(new Promise(() => {}))
    const user = setup()
    await fillValidForm(user)
    await user.dblClick(submitButton())

    expect(postMock).toHaveBeenCalledTimes(1)
    expect(submitButton()).toBeDisabled()
    expect(submitButton()).toHaveTextContent('Enviando...')
  })

  it('400: remove o prefixo answers. e destaca o campo certo', async () => {
    postMock.mockRejectedValue(
      new ApiError(400, 'Validação falhou', [
        { field: 'answers.motivation', message: 'motivation deve ter ao menos 20 caracteres' },
      ]),
    )
    const user = setup()
    await fillValidForm(user)
    await user.click(submitButton())

    expect(
      await screen.findByText('motivation deve ter ao menos 20 caracteres'),
    ).toBeInTheDocument()
    const [motivation, routine] = screen.getAllByRole('textbox')
    expect(motivation).toHaveAttribute('aria-invalid', 'true')
    expect(routine).toHaveAttribute('aria-invalid', 'false')
  })

  it('404: avisa que o pet não está disponível, com link para /pets', async () => {
    postMock.mockRejectedValue(new ApiError(404, 'Pet não encontrado'))
    const user = setup()
    await fillValidForm(user)
    await user.click(submitButton())

    expect(await screen.findByText(/este pet não está mais disponível/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver outros pets/i })).toHaveAttribute('href', '/pets')
  })

  it('409: avisa da solicitação em andamento e acha a existente pelo petId', async () => {
    postMock.mockRejectedValue(new ApiError(409, 'Já existe'))
    getMock.mockResolvedValue({
      data: [makeRequest({ id: 'SOL-1042', petId: pet.id, status: 'Em análise' })],
      total: 1,
    })
    const user = setup()
    await fillValidForm(user)
    await user.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(`Você já tem uma solicitação em andamento para ${pet.name}`)
    expect(alert).toHaveTextContent('SOL-1042')
    expect(screen.getByRole('link', { name: /ver minhas solicitações/i })).toHaveAttribute(
      'href',
      '/solicitacoes',
    )
  })

  it('409: mantém a mensagem mesmo se a busca da solicitação existente falhar', async () => {
    postMock.mockRejectedValue(new ApiError(409, 'Já existe'))
    getMock.mockRejectedValue(ApiError.network())
    const user = setup()
    await fillValidForm(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/solicitação em andamento/i)
  })

  it('422: lista os campos que faltam e linka para /perfil', async () => {
    postMock.mockRejectedValue(
      new ApiError(422, 'Perfil incompleto', [
        { field: 'housing', message: 'housing é obrigatório' },
        { field: 'dailyTime', message: 'dailyTime é obrigatório' },
      ]),
    )
    const user = setup()
    await fillValidForm(user)
    await user.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Complete seu perfil para solicitar a adoção')
    expect(alert).toHaveTextContent('Tipo de moradia, Tempo disponível por dia')
    expect(screen.getByRole('link', { name: /ir para o perfil/i })).toHaveAttribute(
      'href',
      '/perfil',
    )
  })

  it('falha de rede: mostra a mensagem genérica', async () => {
    postMock.mockRejectedValue(ApiError.network())
    const user = setup()
    await fillValidForm(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível enviar a solicitação. Tente novamente.',
    )
    expect(submitButton()).toBeEnabled()
  })
})
