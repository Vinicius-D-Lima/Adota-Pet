import { cx } from './cx'

interface SpinnerProps {
  className?: string
  label?: string
}

/** Indicador de carregamento. Herda a cor do texto (`currentColor`). */
export function Spinner({ className, label = 'Carregando' }: SpinnerProps) {
  return <span className={cx('spinner', className)} role="status" aria-label={label} />
}
