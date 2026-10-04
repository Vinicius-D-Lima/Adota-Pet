import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  /** Nível do título; use `h1` quando o estado ocupa a página inteira. */
  headingAs?: 'h1' | 'h2'
  description?: ReactNode
  /** Use `alert` para estados de erro. */
  role?: 'alert'
  children?: ReactNode
}

/** Estado vazio ou de erro com título, texto e ação opcional. */
export function EmptyState({
  icon,
  title,
  headingAs: Heading = 'h2',
  description,
  role,
  children,
}: EmptyStateProps) {
  return (
    <div className="empty-state" role={role}>
      {icon}
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}
