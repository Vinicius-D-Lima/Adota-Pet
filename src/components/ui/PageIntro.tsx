import type { ReactNode } from 'react'
import { cx } from './cx'
import { Eyebrow } from './Eyebrow'

interface PageIntroProps {
  className?: string
  eyebrow?: ReactNode
  title: ReactNode
  action?: ReactNode
  description?: ReactNode
  children?: ReactNode
}

export function PageIntro({
  eyebrow,
  title,
  action,
  description,
  children,
  className,
}: PageIntroProps) {
  return (
    <div className={cx('mb-[34px]', action ? 'w-full' : 'max-w-[700px]', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {action ? (
        <div className="mb-[13px] flex flex-wrap items-center justify-between gap-4">
          <h1 className="mb-0 text-[clamp(40px,5vw,58px)] leading-[1.08]">{title}</h1>
          {action}
        </div>
      ) : (
        <h1 className="mb-[13px] text-[clamp(40px,5vw,58px)] leading-[1.08]">{title}</h1>
      )}
      {description && (
        <p className="max-w-[700px] text-base leading-[1.65] text-muted">{description}</p>
      )}
      {children}
    </div>
  )
}
