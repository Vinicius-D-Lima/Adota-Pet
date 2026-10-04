import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AdoptionRequest } from '../types'

interface ActiveRequestNoticeProps {
  request: AdoptionRequest
  petName: string
}

export function ActiveRequestNotice({ request, petName }: ActiveRequestNoticeProps) {
  return (
    <div className="info-note active-request-notice" role="status">
      <Info size={18} />
      <p>
        Você já tem uma solicitação em andamento para {petName} ({request.id} · {request.status}).{' '}
        <Link to="/solicitacoes">Ver minhas solicitações</Link>
      </p>
    </div>
  )
}
