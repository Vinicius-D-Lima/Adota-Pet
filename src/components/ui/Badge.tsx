import type { ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'review' | 'approved' | 'sent' | 'declined'

interface BadgeProps {
  tone: BadgeTone
  children: ReactNode
}

/** Etiqueta arredondada colorida por `tone`. */
export function Badge({ tone, children }: BadgeProps) {
  return <span className={cx('status-pill', `status-${tone}`)}>{children}</span>
}
