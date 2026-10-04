import { AlertCircle, CheckCircle2, Clock3, type LucideIcon } from 'lucide-react'
import type { RequestStatus } from '../../types'
import { Badge, type BadgeTone } from './Badge'

const statusConfig: Record<RequestStatus, [LucideIcon, BadgeTone]> = {
  'Em análise': [Clock3, 'review'],
  Aprovada: [CheckCircle2, 'approved'],
  Enviada: [CheckCircle2, 'sent'],
  Recusada: [AlertCircle, 'declined'],
  Cancelada: [AlertCircle, 'declined'],
}

export function StatusPill({ status }: { status: RequestStatus }) {
  const [Icon, tone] = statusConfig[status] || [Clock3, 'review']
  return (
    <Badge tone={tone}>
      <Icon size={14} /> {status}
    </Badge>
  )
}
