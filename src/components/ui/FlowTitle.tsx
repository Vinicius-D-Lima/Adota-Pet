import type { ReactNode } from 'react'
import { cx } from './cx'
import { Eyebrow } from './Eyebrow'

interface FlowTitleProps {
  eyebrow: ReactNode
  title: ReactNode
  description: ReactNode
  /** Versão mais estreita e com título menor (questionário). */
  compact?: boolean
}

/** Título centralizado das etapas do fluxo de adoção. */
export function FlowTitle({ eyebrow, title, description, compact = false }: FlowTitleProps) {
  return (
    <div className={cx('mx-auto mb-10 text-center', compact ? 'max-w-[760px]' : 'max-w-[820px]')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1
        className={cx(
          'mb-[13px] leading-[1.08] [&_em]:italic [&_em]:text-coral',
          compact ? 'text-[clamp(36px,4.5vw,50px)]' : 'text-[clamp(40px,5vw,58px)]',
        )}
      >
        {title}
      </h1>
      <p className="text-base leading-[1.65] text-muted">{description}</p>
    </div>
  )
}
