import type { HTMLAttributes } from 'react'
import { cx } from './cx'

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'section'
}

/** Largura máxima do conteúdo (1160 px) com margem lateral que diminui no celular. */
export function Container({ as: Tag = 'div', className, ...props }: ContainerProps) {
  return (
    <Tag className={cx('mx-auto w-full max-w-[1200px] px-3.5 md:px-5', className)} {...props} />
  )
}
