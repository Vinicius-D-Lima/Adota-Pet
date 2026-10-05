import { cx } from './cx'

interface SpinnerProps {
  className?: string
  label?: string
}

/** Indicador de carregamento. Herda a cor do texto (`currentColor`). */
export function Spinner({ className, label = 'Carregando' }: SpinnerProps) {
  return (
    <span
      className={cx(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
      role="status"
      aria-label={label}
    />
  )
}
