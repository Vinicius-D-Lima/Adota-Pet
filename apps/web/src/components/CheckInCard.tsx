import { checkInStatusLabels, type CheckIn } from '@adotapet/shared'
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock3,
  MessageSquareText,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCheckInPhotoUrl } from '../hooks/useAdoptions'
import { resolveApiUrl } from '../lib/api'
import { isCheckInOverdue } from '../utils/checkIns'
import { Alert, Badge, Card, type BadgeTone } from './ui'

const statusTone: Record<CheckIn['status'], BadgeTone> = {
  PENDENTE: 'review',
  ATRASADO: 'declined',
  ENVIADO: 'sent',
  REVISADO: 'approved',
}

const statusIcon = {
  PENDENTE: Clock3,
  ATRASADO: AlertTriangle,
  ENVIADO: CheckCircle2,
  REVISADO: CheckCircle2,
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

function CheckInPhoto({
  checkInId,
  photoId,
  index,
}: {
  checkInId: string
  photoId: string
  index: number
}) {
  const urlQuery = useCheckInPhotoUrl(checkInId, photoId)
  return (
    <li className="overflow-hidden rounded-xl border border-line bg-cream">
      {urlQuery.data ? (
        <img
          src={resolveApiUrl(urlQuery.data.url)}
          alt={`Foto ${index + 1} do check-in`}
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="grid h-28 place-items-center text-muted">
          <Camera size={20} />
        </div>
      )}
    </li>
  )
}

interface CheckInCardProps {
  checkIn: CheckIn
  children?: ReactNode
}

export function CheckInCard({ checkIn, children }: CheckInCardProps) {
  const overdue = isCheckInOverdue(checkIn)
  const needsMoreInfo = checkIn.status === 'PENDENTE' && Boolean(checkIn.reviewerComment)
  const Icon = statusIcon[checkIn.status]

  return (
    <Card
      as="article"
      className={`grid gap-4 p-5 ${overdue ? 'border-[#c4543d] bg-[#fff8f4]' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <CalendarClock size={15} /> Previsto para {formatDate(checkIn.dueDate)}
          </p>
          <h3 className="mb-0 text-base">Check-in de {formatDate(checkIn.dueDate)}</h3>
        </div>
        <Badge tone={statusTone[checkIn.status]}>
          <Icon size={14} /> {checkInStatusLabels[checkIn.status]}
        </Badge>
      </div>

      {overdue && checkIn.status === 'ATRASADO' && (
        <Alert role="note">Este check-in passou do prazo. Envie o relato quando puder.</Alert>
      )}
      {needsMoreInfo && (
        <Alert role="note">A organização pediu mais informações neste check-in.</Alert>
      )}

      {checkIn.report && (
        <div>
          <p className="mb-1 text-xs font-bold text-forest-800">Seu relato</p>
          <p className="mb-0 whitespace-pre-wrap text-sm leading-6 text-muted">{checkIn.report}</p>
        </div>
      )}

      {checkIn.photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Fotos do check-in">
          {checkIn.photos.map((photoId, index) => (
            <CheckInPhoto key={photoId} checkInId={checkIn.id} photoId={photoId} index={index} />
          ))}
        </ul>
      )}

      {checkIn.reviewerComment && !needsMoreInfo && (
        <div className="rounded-xl bg-forest-50 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-forest-800">
            <MessageSquareText size={15} /> Comentário da organização
          </p>
          <p className="mb-0 whitespace-pre-wrap text-sm leading-6 text-muted">
            {checkIn.reviewerComment}
          </p>
        </div>
      )}

      {children}
    </Card>
  )
}
