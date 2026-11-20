import type { ReactNode } from 'react'
import { cx } from './cx'
import { Eyebrow } from './Eyebrow'

interface PageIntroProps {
  className?: string
  eyebrow?: ReactNode
  title: ReactNode
  action?: ReactNode
  actionFloatingMobile?: boolean
  description?: ReactNode
  children?: ReactNode
}

export function PageIntro({
  eyebrow,
  title,
  action,
  actionFloatingMobile = false,
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
          <div
            className={cx(
              actionFloatingMobile &&
                'fixed bottom-6 right-6 z-40 drop-shadow-xl md:static md:bottom-auto md:right-auto md:z-auto md:drop-shadow-none',
            )}
          >
            {action}
          </div>
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
