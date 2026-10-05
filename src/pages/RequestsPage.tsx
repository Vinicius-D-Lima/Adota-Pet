import { CalendarDays, ChevronRight, ClipboardList, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageIntro,
  StatusPill,
} from '../components/ui'
import { useAdoptionRequests, useCancelAdoptionRequest } from '../hooks/useAdoptionRequests'
import { ApiError } from '../lib/ApiError'
import type { AdoptionRequest } from '../types'
import { formatRequestDate } from '../utils/formatRequestDate'
import { canCancelRequest } from '../utils/requestStatus'

const CANCEL_CONFLICT_MESSAGE =
  'Esta solicitação não pode mais ser cancelada porque o status dela mudou.'
const CANCEL_ERROR_MESSAGE = 'Não foi possível cancelar a solicitação. Tente novamente.'

export function RequestsPage() {
  const requestsQuery = useAdoptionRequests()
  const cancelRequest = useCancelAdoptionRequest()
  const [cancelError, setCancelError] = useState('')
  const [toCancel, setToCancel] = useState<{
    request: AdoptionRequest
    opener: HTMLElement
  } | null>(null)

  const confirmCancel = async (request: AdoptionRequest) => {
    setCancelError('')
    try {
      await cancelRequest.mutateAsync(request.id)
    } catch (error) {
      setCancelError(
        error instanceof ApiError && error.statusCode === 409
          ? CANCEL_CONFLICT_MESSAGE
          : CANCEL_ERROR_MESSAGE,
      )
    }
    setToCancel(null)
  }

  if (requestsQuery.isPending) {
    return <div className="app-feedback">Carregando solicitações...</div>
  }

  // Só é erro de tela cheia se nunca houve dados: um refetch que falha não pode derrubar o modal aberto.
  if (requestsQuery.isLoadingError) {
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
        {cancelError && <Alert>{cancelError}</Alert>}
        {requests.length ? (
          <div className="requests-list">
            {requests.map((request) => {
              const { pet } = request
              return (
                <Card
                  as="article"
                  className="request-card"
                  id={`request-${request.id}`}
                  key={request.id}
                  tabIndex={-1}
                >
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
                      <Button
                        variant="text-danger"
                        onClick={(event) => {
                          setCancelError('')
                          setToCancel({ request, opener: event.currentTarget })
                        }}
                      >
                        Cancelar
                      </Button>
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
                </Card>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardList size={36} />}
            title="Nenhuma solicitação ainda"
            description="Quando você enviar uma solicitação de adoção, ela aparecerá aqui."
          >
            <LinkButton to="/pets">Encontrar um pet</LinkButton>
          </EmptyState>
        )}
      </section>
      {toCancel && (
        <ConfirmDialog
          title={`Cancelar a solicitação de ${toCancel.request.pet?.name ?? 'este pet'}?`}
          description="Essa ação não pode ser desfeita."
          confirmLabel="Cancelar solicitação"
          busy={cancelRequest.isPending}
          // O botão "Cancelar" some quando o status muda; nesse caso o foco vai para o cartão.
          returnFocus={() =>
            toCancel.opener.isConnected
              ? toCancel.opener
              : document.getElementById(`request-${toCancel.request.id}`)
          }
          onConfirm={() => void confirmCancel(toCancel.request)}
          onClose={() => setToCancel(null)}
        />
      )}
    </div>
  )
}
