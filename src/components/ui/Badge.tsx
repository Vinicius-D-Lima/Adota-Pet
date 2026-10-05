import type { ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'review' | 'approved' | 'sent' | 'declined'

const tones: Record<BadgeTone, string> = {
  review: 'bg-[#fff0d3] text-[#98620c]',
  approved: 'bg-forest-100 text-forest-700',
  sent: 'bg-forest-100 text-forest-700',
  declined: 'bg-[#fde8e1] text-[#9b4b35]',
}

interface BadgeProps {
  tone: BadgeTone
  children: ReactNode
}

/** Etiqueta arredondada colorida por `tone`. */
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-1.5 text-[10px] font-bold',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}
