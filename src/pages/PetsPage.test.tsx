import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { pets } from '../data/pets'
import { PetsPage } from './PetsPage'

function setup() {
  render(
    <MemoryRouter>
      <PetsPage pets={pets} favorites={[]} onFavorite={() => {}} />
    </MemoryRouter>,
  )
  return userEvent.setup()
}

const countText = () => document.querySelector('.results-bar strong')?.textContent

describe('PetsPage - filtros', () => {
  it('mostra todos os pets sem filtros', () => {
    setup()
    expect(countText()).toBe(String(pets.length))
    expect(screen.queryByRole('button', { name: /limpar/i })).not.toBeInTheDocument()
  })

  it('filtra pela busca por nome, raça ou cidade', async () => {
    const user = setup()
    await user.type(screen.getByPlaceholderText(/busque por nome/i), 'beagle')
    expect(countText()).toBe('1')
    expect(screen.getByRole('heading', { name: 'Bento' })).toBeInTheDocument()
  })

  it('combina filtros de espécie, porte e sexo', async () => {
    const user = setup()
    await user.selectOptions(screen.getByLabelText('Filtrar por espécie'), 'Cachorro')
    await user.selectOptions(screen.getByLabelText('Filtrar por porte'), 'Médio')
    await user.selectOptions(screen.getByLabelText('Filtrar por sexo'), 'Macho')
    const expected = pets.filter(
      (p) => p.species === 'Cachorro' && p.size === 'Médio' && p.sex === 'Macho',
    )
    expect(countText()).toBe(String(expected.length))
    expect(screen.getByRole('heading', { name: 'Bento' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Luna' })).not.toBeInTheDocument()
  })

  it('o botão Limpar restaura todos os filtros', async () => {
    const user = setup()
    await user.type(screen.getByPlaceholderText(/busque por nome/i), 'beagle')
    await user.selectOptions(screen.getByLabelText('Filtrar por espécie'), 'Gato')
    expect(screen.getByText('Nenhum pet encontrado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^limpar$/i }))
    expect(countText()).toBe(String(pets.length))
    expect(screen.getByPlaceholderText(/busque por nome/i)).toHaveValue('')
    expect(screen.getByLabelText('Filtrar por espécie')).toHaveValue('Todos')
  })
})
