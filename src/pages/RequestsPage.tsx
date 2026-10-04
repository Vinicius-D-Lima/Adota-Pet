import { CalendarDays, ChevronRight, ClipboardList, Info, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageIntro, StatusPill } from '../components/UI'
import { useAdoptionRequests, useCancelAdoptionRequest } from '../hooks/useAdoptionRequests'
import { ApiError } from '../lib/ApiError'
import { formatRequestDate } from '../utils/formatRequestDate'
import { canCancelRequest } from '../utils/requestStatus'

const CANCEL_CONFLICT_MESSAGE =
  'Esta solicitação não pode mais ser cancelada porque o status dela mudou.'
const CANCEL_ERROR_MESSAGE = 'Não foi possível cancelar a solicitação. Tente novamente.'

export function RequestsPage() {
  const requestsQuery = useAdoptionRequests()
  const cancelRequest = useCancelAdoptionRequest()
  const [cancelError, setCancelError] = useState('')

  const cancel = async (requestId: string) => {
    setCancelError('')
    try {
      await cancelRequest.mutateAsync(requestId)
    } catch (error) {
      setCancelError(
        error instanceof ApiError && error.statusCode === 409
          ? CANCEL_CONFLICT_MESSAGE
          : CANCEL_ERROR_MESSAGE,
      )
    }
  }

  if (requestsQuery.isPending) {
    return <div className="app-feedback">Carregando solicitações...</div>
  }

  if (requestsQuery.isError) {
    return (
      <div className="app-feedback error" role="alert">
        Não foi possível carregar suas solicitações. Tente novamente.
      </div>
    )
  }

  const requests = requestsQuery.data

  return (
    <div className="page-surface">
      <section className="container page-section">
        <PageIntro
          eyebrow="Acompanhamento"
          title="Minhas solicitações"
          description="Veja o andamento das suas adoções e as próximas etapas de cada processo."
        />
        {cancelError && (
          <div className="form-error" role="alert">
            <Info size={17} /> {cancelError}
          </div>
        )}
        {requests.length ? (
          <div className="requests-list">
            {requests.map((request) => {
              const { pet } = request
              return (
                <article className="request-card" key={request.id}>
                  {pet && (
                    <img src={pet.image} alt={pet.name} width={145} height={110} loading="lazy" />
                  )}
                  <div className="request-main">
                    <div className="request-topline">
                      <div>
                        <span className="request-code">{request.id}</span>
                        <h2>{pet ? pet.name : 'Pet indisponível'}</h2>
                      </div>
                      <StatusPill status={request.status} />
                    </div>
                    <p>{request.message}</p>
                    <div className="request-meta">
                      <span>
                        <CalendarDays size={16} /> Enviada em {formatRequestDate(request.date)}
                      </span>
                      {pet && (
                        <span>
                          <MapPin size={16} /> {pet.organization}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="request-actions">
                    {canCancelRequest(request.status) && (
                      <button
                        className="text-button danger"
                        disabled={cancelRequest.isPending && cancelRequest.variables === request.id}
                        onClick={() => void cancel(request.id)}
                      >
                        Cancelar
                      </button>
                    )}
                    {pet && (
                      <Link
                        className="icon-button"
                        to={`/pets/${pet.id}`}
                        aria-label={`Ver ${pet.name}`}
                      >
                        <ChevronRight />
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <ClipboardList size={36} />
            <h2>Nenhuma solicitação ainda</h2>
            <p>Quando você enviar uma solicitação de adoção, ela aparecerá aqui.</p>
            <Link className="button primary" to="/pets">
              Encontrar um pet
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
