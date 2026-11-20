import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function setup(props: { busy?: boolean } = {}) {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  const ui = (busy: boolean) => (
    <>
      <main data-testid="page">
        <button>Abrir</button>
      </main>
      <ConfirmDialog
        title="Cancelar?"
        description="Não pode ser desfeito."
        confirmLabel="Confirmar"
        busy={busy}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </>
  )
  const view = render(ui(props.busy ?? false))
  return { ...view, onClose, onConfirm, rerenderBusy: (busy: boolean) => view.rerender(ui(busy)) }
}

afterEach(() => {
  document.body.style.overflow = ''
})

describe('ConfirmDialog', () => {
  it('deixa o restante da página inerte e trava a rolagem enquanto aberto', () => {
    const { container, unmount } = setup()

    expect(container).toHaveAttribute('inert')
    expect(screen.getByRole('dialog').parentElement).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(container).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('')
  })

  it('não remove um inert que já existia antes de abrir', () => {
    const outside = document.createElement('div')
    outside.setAttribute('inert', '')
    document.body.append(outside)

    const { unmount } = setup()
    unmount()

    expect(outside).toHaveAttribute('inert')
    outside.remove()
  })

  it('mantém o foco no diálogo quando os botões ficam desabilitados', async () => {
    const { rerenderBusy } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    screen.getByRole('button', { name: 'Confirmar' }).focus()

    rerenderBusy(true)

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
})
