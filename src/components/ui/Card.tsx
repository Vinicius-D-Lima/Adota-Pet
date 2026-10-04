import type { HTMLAttributes } from 'react'
import { cx } from './cx'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'aside'
}

/** Superfície base (fundo branco, borda e raio). Componha com `className` para o layout. */
export function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return <Tag className={cx('card', className)} {...props} />
}
