import type { ReactNode } from 'react'
import { cx } from './cx'

interface FeedbackProps {
  children: ReactNode
  /** Estado de erro: cor de alerta e `role="alert"`. */
  error?: boolean
}

/** Mensagem centralizada de carregamento ou erro que ocupa a área da página. */
export function Feedback({ children, error = false }: FeedbackProps) {
  return (
    <div
      className={cx(
        'flex min-h-[60vh] items-center justify-center p-8 text-center',
        error ? 'text-[#a33f2d]' : 'text-muted',
      )}
      role={error ? 'alert' : undefined}
    >
      {children}
    </div>
  )
}
