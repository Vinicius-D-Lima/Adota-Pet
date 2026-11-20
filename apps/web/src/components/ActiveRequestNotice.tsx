import { Link } from 'react-router-dom'
import type { AdoptionRequest } from '../types'
import { InfoNote } from './ui'

interface ActiveRequestNoticeProps {
  request: AdoptionRequest
  petName: string
}

export function ActiveRequestNotice({ request, petName }: ActiveRequestNoticeProps) {
  return (
    <InfoNote large role="status">
      <p className="mb-0">
        Você já tem uma solicitação em andamento para {petName} ({request.id} · {request.status}).{' '}
        <Link to="/solicitacoes">Ver minhas solicitações</Link>
      </p>
    </InfoNote>
  )
}
