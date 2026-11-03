import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { RatingStars } from './RatingStars'

describe('RatingStars', () => {
  it('exibe a nota e as estrelas em modo de leitura', () => {
    renderWithProviders(<RatingStars value={4.4} readOnly />)

    expect(screen.getByRole('img', { name: '4.4 de 5 estrelas' })).toBeInTheDocument()
  })

  it('seleciona uma nota com clique e navega pelas estrelas com as setas', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<RatingStars value={0} onChange={onChange} label="sua experiência" />)

    const group = screen.getByRole('radiogroup', { name: 'Avaliação: sua experiência' })
    expect(group).toBeInTheDocument()
    const first = screen.getByRole('radio', { name: '1 de 5 estrelas' })
    await user.click(first)
    expect(onChange).toHaveBeenLastCalledWith(1)

    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith(2)
    expect(screen.getByRole('radio', { name: '2 de 5 estrelas' })).toHaveFocus()
  })
})
