import { Link, type LinkProps } from 'react-router-dom'
import { cx } from './cx'

/** Link discreto para voltar à etapa ou à lista anterior. */
export function BackLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cx(
        'mb-[30px] inline-flex items-center gap-[7px] text-[13px] font-semibold text-muted hover:text-forest-800',
        className,
      )}
      {...props}
    />
  )
}
