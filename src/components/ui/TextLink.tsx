import { Link, type LinkProps } from 'react-router-dom'
import { cx } from './cx'

/** Link de texto em destaque (com seta ou ícone ao lado do rótulo). */
export function TextLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cx(
        'inline-flex items-center gap-[7px] text-sm font-bold text-forest-800 hover:text-coral-dark',
        className,
      )}
      {...props}
    />
  )
}
