import type { ReactNode } from 'react'
import { cx } from './cx'
import { Eyebrow } from './Eyebrow'

interface PageIntroProps {
  className?: string
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}

export function PageIntro({ eyebrow, title, description, children, className }: PageIntroProps) {
  return (
    <div className={cx('mb-[34px] max-w-[700px]', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="mb-[13px] text-[clamp(40px,5vw,58px)] leading-[1.08]">{title}</h1>
      {description && <p className="text-base leading-[1.65] text-muted">{description}</p>}
      {children}
    </div>
  )
}
