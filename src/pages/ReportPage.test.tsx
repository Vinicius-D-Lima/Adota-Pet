import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { ReportPage } from './ReportPage'

const setup = () =>
  renderWithProviders(<ReportPage />, {
    route: '/denuncias/nova?targetType=PET&targetId=pet-123',
  })

describe('ReportPage', () => {
  it('valida categoria e descrição antes de aceitar o formulário', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Validar formulário' }))

    expect(await screen.findByText('Selecione uma categoria.')).toBeInTheDocument()
    expect(screen.getByText('Descreva o que aconteceu.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('orienta sobre canais oficiais antes e depois de validar denúncia de abandono', async () => {
    const user = userEvent.setup()
    setup()

    await user.selectOptions(screen.getByLabelText('Categoria'), 'ABANDONO')
    expect(screen.getAllByText(/canais oficiais/)).toHaveLength(2)
    await user.type(
      screen.getByLabelText(/Descrição/),
      'O animal está sem água e abrigo há vários dias.',
    )
    await user.click(screen.getByRole('button', { name: 'Validar formulário' }))

    expect(await screen.findByText(/Formulário validado/)).toHaveTextContent(
      'A denúncia não foi enviada',
    )
  })

  it('recusa imagem fora dos formatos aceitos', async () => {
    setup()
    const invalidImage = new File(['svg'], 'imagem.svg', { type: 'image/svg+xml' })

    fireEvent.change(screen.getByLabelText(/Imagens \(opcional\)/), {
      target: { files: [invalidImage] },
    })

    expect(
      await screen.findByText('Use imagens nos formatos JPEG, PNG ou WebP.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('imagem.svg')).not.toBeInTheDocument()
  })

  it('permite remover um anexo válido antes de validar', async () => {
    const user = userEvent.setup()
    setup()
    const image = new File(['png'], 'foto.png', { type: 'image/png' })

    await user.upload(screen.getByLabelText(/Imagens \(opcional\)/), image)
    expect(await screen.findByText('foto.png')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remover' }))

    expect(screen.queryByText('foto.png')).not.toBeInTheDocument()
  })
})
