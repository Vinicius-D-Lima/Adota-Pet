import { AlertCircle, CheckCircle2, Clock3, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { RequestStatus } from '../types'

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

interface StatusPillProps {
  status: RequestStatus
}

const statusConfig: Record<RequestStatus, [LucideIcon, string]> = {
  'Em análise': [Clock3, 'status-review'],
  'Aprovada': [CheckCircle2, 'status-approved'],
  'Enviada': [CheckCircle2, 'status-sent'],
  'Recusada': [AlertCircle, 'status-declined'],
  'Cancelada': [AlertCircle, 'status-declined'],
}

export function StatusPill({ status }: StatusPillProps) {
  const [Icon, className] = statusConfig[status] || [Clock3, 'status-review']
  return <span className={`status-pill ${className}`}><Icon size={14} /> {status}</span>
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  full?: boolean
}

export function Field({ label, hint, children, full = false }: FieldProps) {
  return (
    <label className={full ? 'field full' : 'field'}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
