import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { pets } from '../data/pets'
import type { AdoptionRequest } from '../types'
import { QuestionnairePage } from './QuestionnairePage'

const longText = 'Texto com mais de vinte caracteres para validar.'

function setup() {
  const request: AdoptionRequest = {
    id: 'SOL-TESTE',
    petId: pets[0].id,
    status: 'Enviada',
    date: '01 jan 2026',
    message: '',
  }
  const onSubmit = vi.fn(() => request)
  render(
    <MemoryRouter initialEntries={[`/pets/${pets[0].id}/questionario`]}>
      <Routes>
        <Route
          path="/pets/:petId/questionario"
          element={<QuestionnairePage pets={pets} onSubmit={onSubmit} />}
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
    expect(screen.getByText(/preencha as respostas com mais detalhes/i)).toBeInTheDocument()
  })

  it('bloqueia o envio quando os compromissos não foram marcados', async () => {
    const { onSubmit, user } = setup()
    const [motivation, routine, adaptation] = screen.getAllByRole('textbox')
    await user.type(motivation, longText)
    await user.type(routine, longText)
    await user.type(adaptation, longText)
    await user.click(submitButton())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/confirme os dois/i)).toBeInTheDocument()
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
