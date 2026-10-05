import type { HTMLAttributes } from 'react'
import { cx } from './cx'

/** Fundo das páginas internas: um degradê suave que termina no fundo do site. */
export function PageSurface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('min-h-[70vh] bg-[linear-gradient(180deg,#f6f8f3_0,#fbfaf6_340px)]', className)}
      {...props}
    />
  )
}
