import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let shouldThrow = true

function Bomb() {
  if (shouldThrow) throw new Error('falha de renderização')
  return <p>Conteúdo da página</p>
}

beforeEach(() => {
  shouldThrow = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('mostra o fallback em vez de uma tela em branco quando um filho lança erro', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })

  it('"Tentar novamente" renderiza o conteúdo de novo', async () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('descarta o fallback quando as resetKeys mudam (ex.: navegação)', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['/a']}>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    shouldThrow = false
    rerender(
      <ErrorBoundary resetKeys={['/b']}>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument()
  })
})
