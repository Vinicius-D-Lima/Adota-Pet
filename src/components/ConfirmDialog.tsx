import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  /** Requisição em andamento: trava os botões, o Esc e o clique fora. */
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
  /** Devolve o elemento que recebe o foco ao fechar; por padrão, o que estava focado ao abrir. */
  returnFocus?: () => HTMLElement | null
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select, textarea'

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Voltar',
  busy = false,
  onConfirm,
  onClose,
  returnFocus,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Os handlers mudam a cada render; o efeito de foco/teclado só deve rodar ao abrir e fechar.
  const latest = useRef({ busy, onClose, returnFocus })
  useEffect(() => {
    latest.current = { busy, onClose, returnFocus }
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // O foco inicial vai para a opção segura, não para a destrutiva.
    cancelRef.current?.focus()

    // Deixa o resto da página inerte (leitor de tela e cliques) e trava a rolagem ao fundo.
    const inerted = Array.from(document.body.children).filter(
      (element) => element !== backdropRef.current && !element.hasAttribute('inert'),
    )
    inerted.forEach((element) => element.setAttribute('inert', ''))
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return

      if (event.key === 'Escape') {
        event.preventDefault()
        if (!latest.current.busy) latest.current.onClose()
        return
      }
      if (event.key !== 'Tab') return

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      inerted.forEach((element) => element.removeAttribute('inert'))
      document.body.style.overflow = previousOverflow
      const target = latest.current.returnFocus?.() ?? opener
      if (target?.isConnected) target.focus()
    }
  }, [])

  // Botões desabilitados perdem o foco; mantê-lo no diálogo evita que ele caia no <body>.
  useEffect(() => {
    if (busy) dialogRef.current?.focus()
  }, [busy])

  return createPortal(
    <div
      ref={backdropRef}
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="modal-actions">
          <button ref={cancelRef} className="button ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button className="button danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
