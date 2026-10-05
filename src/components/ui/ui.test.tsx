import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Button, Checkbox, EmptyState, Field, Input, LinkButton, StatusPill } from '.'

describe('componentes de ui', () => {
  it('Button aplica variante, tamanho e largura total', () => {
    render(
      <Button variant="danger" size="sm" fullWidth>
        Remover
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Remover' })
    expect(button).toHaveClass('button', 'danger', 'sm', 'full')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('Button em loading fica desabilitado, ocupado e não dispara onClick', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Enviando...
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Enviando...' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('LinkButton é um link com a aparência de botão', () => {
    render(
      <MemoryRouter>
        <LinkButton to="/pets" variant="secondary">
          Ver pets
        </LinkButton>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Ver pets' })
    expect(link).toHaveAttribute('href', '/pets')
    expect(link).toHaveClass('button', 'secondary')
  })

  it('Field mostra o erro no lugar da dica e Input recebe aria-invalid', () => {
    render(
      <Field label="Nome" hint="dica" error="Obrigatório">
        <Input invalid />
      </Field>,
    )
    expect(screen.getByText('Obrigatório')).toBeInTheDocument()
    expect(screen.queryByText('dica')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Nome/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('Checkbox exibe descrição e erro', () => {
    render(<Checkbox label="Aceito" description="Detalhes" error="Marque" />)
    expect(screen.getByRole('checkbox', { name: /Aceito/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Detalhes')).toBeInTheDocument()
    expect(screen.getByText('Marque')).toBeInTheDocument()
  })

  it('EmptyState e StatusPill renderizam título e status', () => {
    render(
      <>
        <EmptyState title="Nada aqui" description="Tente de novo" role="alert" />
        <StatusPill status="Aprovada" />
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Nada aqui')
    expect(screen.getByText('Aprovada').closest('span')).toHaveClass('status-approved')
  })
})
