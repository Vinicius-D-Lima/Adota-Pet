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
    <div
      className="flex flex-col items-center rounded-[20px] border border-dashed border-[#cdd8d1] bg-white px-5 py-[70px] text-center text-muted"
      role={role}
    >
      {icon}
      <Heading className="mb-2 mt-4 text-2xl">{title}</Heading>
      {description && <p className="mb-4">{description}</p>}
      {children}
    </div>
  )
}
