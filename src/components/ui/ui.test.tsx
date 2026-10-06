import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Select,
  StatusPill,
  Textarea,
  cx,
} from '.'

describe('componentes de ui', () => {
  it('Button aplica variante, tamanho e largura total', () => {
    render(
      <Button variant="danger" size="sm" fullWidth>
        Remover
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Remover' })
    expect(button).toHaveClass('bg-[#a55039]', 'min-h-[38px]', 'w-full')
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
    expect(link).toHaveClass('bg-white', 'text-forest-800')
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
    expect(screen.getByText('Aprovada').closest('span')).toHaveClass('bg-forest-100')
  })

  it('cx resolve conflitos do Tailwind: vence a última classe', () => {
    expect(cx('p-3 text-sm', false, 'p-5')).toBe('text-sm p-5')
  })

  it('Input, Select, Textarea e Checkbox repassam a ref ao react-hook-form', async () => {
    const onSubmit = vi.fn()
    function Demo() {
      const { register, handleSubmit } = useForm({
        defaultValues: { nome: 'Ana', porte: 'Médio', texto: 'oi', aceito: false },
      })
      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Input aria-label="nome" {...register('nome')} />
          <Select aria-label="porte" {...register('porte')}>
            <option>Pequeno</option>
            <option>Médio</option>
          </Select>
          <Textarea aria-label="texto" {...register('texto')} />
          <Checkbox label="aceito" {...register('aceito')} />
          <Button type="submit">Enviar</Button>
        </form>
      )
    }
    render(<Demo />)
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('nome'))
    await user.type(screen.getByLabelText('nome'), 'Bia')
    await user.selectOptions(screen.getByLabelText('porte'), 'Pequeno')
    await user.click(screen.getByRole('checkbox', { name: /aceito/ }))
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(onSubmit).toHaveBeenCalledWith(
      { nome: 'Bia', porte: 'Pequeno', texto: 'oi', aceito: true },
      expect.anything(),
    )
  })
})
