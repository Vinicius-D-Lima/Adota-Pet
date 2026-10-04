import type { ReactNode } from 'react'

interface PageIntroProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}

export function PageIntro({ eyebrow, title, description, children }: PageIntroProps) {
  return (
    <div className="page-intro">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}
