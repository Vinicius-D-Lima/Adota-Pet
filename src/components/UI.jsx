import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react'

export function PageIntro({ eyebrow, title, description, children }) {
  return (
    <div className="page-intro">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}

export function StatusPill({ status }) {
  const config = {
    'Em análise': [Clock3, 'status-review'],
    'Aprovada': [CheckCircle2, 'status-approved'],
    'Enviada': [CheckCircle2, 'status-sent'],
    'Recusada': [AlertCircle, 'status-declined'],
    'Cancelada': [AlertCircle, 'status-declined'],
  }
  const [Icon, className] = config[status] || [Clock3, 'status-review']
  return <span className={`status-pill ${className}`}><Icon size={14} /> {status}</span>
}

export function Field({ label, hint, children, full = false }) {
  return (
    <label className={full ? 'field full' : 'field'}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
