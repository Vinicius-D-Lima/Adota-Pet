import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { petFixture } from '../test/petFixture'
import type { AdoptionRequest } from '../types'
import { QuestionnairePage } from './QuestionnairePage'

const mocks = vi.hoisted(() => ({ usePet: vi.fn() }))
vi.mock('../hooks/usePets', () => ({ usePet: mocks.usePet }))

beforeEach(() => {
  mocks.usePet.mockReturnValue({ data: petFixture, isPending: false, isError: false })
})

const longText = 'Texto com mais de vinte caracteres para validar.'

function setup() {
  const request: AdoptionRequest = {
    id: 'SOL-TESTE',
    petId: petFixture.id,
    status: 'Enviada',
    date: '01 jan 2026',
    message: '',
  }
  const onSubmit = vi.fn(() => Promise.resolve(request))
  render(
    <MemoryRouter initialEntries={[`/pets/${petFixture.id}/questionario`]}>
      <Routes>
        <Route
          path="/pets/:petId/questionario"
          element={<QuestionnairePage onSubmit={onSubmit} />}
        />
        <Route path="/solicitacoes/:id/enviada" element={<p>Solicitação enviada</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { onSubmit, user: userEvent.setup() }
}

const submitButton = () => screen.getByRole('button', { name: /revisar e enviar/i })

describe('QuestionnairePage - validação', () => {
  it('bloqueia o envio e mostra erro com o formulário vazio', async () => {
    const { onSubmit, user } = setup()
    await user.click(submitButton())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/explique sua motivação usando pelo menos 20/i)).toBeInTheDocument()
    expect(screen.getByText(/descreva sua rotina usando pelo menos 20/i)).toBeInTheDocument()
    expect(
      screen.getByText(/explique como será a adaptação usando pelo menos 15/i),
    ).toBeInTheDocument()
  })

  it('bloqueia o envio quando os compromissos não foram marcados', async () => {
    const { onSubmit, user } = setup()
    const [motivation, routine, adaptation] = screen.getAllByRole('textbox')
    await user.type(motivation, longText)
    await user.type(routine, longText)
    await user.type(adaptation, longText)
    await user.click(submitButton())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByText(/ciente dos custos recorrentes/i, { selector: 'small' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/confirme o compromisso com o bem-estar/i)).toBeInTheDocument()
  })

  it('envia quando todos os critérios são atendidos', async () => {
    const { onSubmit, user } = setup()
    const [motivation, routine, adaptation] = screen.getAllByRole('textbox')
    await user.type(motivation, longText)
    await user.type(routine, longText)
    await user.type(adaptation, longText)
    await user.click(screen.getByRole('checkbox', { name: /custos recorrentes/i }))
    await user.click(screen.getByRole('checkbox', { name: /compromisso com o bem-estar/i }))
    await user.click(submitButton())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Solicitação enviada')).toBeInTheDocument()
  })
})
