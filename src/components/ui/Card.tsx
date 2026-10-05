import type { HTMLAttributes } from 'react'
import { cx } from './cx'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'aside'
}

/** Classes da superfície do Card, para elementos que não podem ser um `Card` (por exemplo um `<form>`). */
export const cardClass = 'rounded-[20px] border border-line bg-white'

/** Superfície base (fundo branco, borda e raio). Componha com `className` para o layout. */
export function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return <Tag className={cx(cardClass, className)} {...props} />
}
