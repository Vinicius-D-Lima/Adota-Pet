import { CalendarDays, ChevronRight, ClipboardList, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  Alert,
  Button,
  Card,
  Container,
  EmptyState,
  Feedback,
  LinkButton,
  PageIntro,
  PageSurface,
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
    return <Feedback>Carregando solicitações...</Feedback>
  }

  // Só é erro de tela cheia se nunca houve dados: um refetch que falha não pode derrubar o modal aberto.
  if (requestsQuery.isLoadingError) {
    return <Feedback error>Não foi possível carregar suas solicitações. Tente novamente.</Feedback>
  }

  const requests = requestsQuery.data

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <PageIntro
          eyebrow="Acompanhamento"
          title="Minhas solicitações"
          description="Veja o andamento das suas adoções e as próximas etapas de cada processo."
        />
        {cancelError && <Alert>{cancelError}</Alert>}
        {requests.length ? (
          <div className="grid max-w-[930px] gap-3.5">
            {requests.map((request) => {
              const { pet } = request
              return (
                <Card
                  as="article"
                  className="grid grid-cols-[90px_1fr] gap-5 rounded-[18px] p-4 md:grid-cols-[145px_minmax(0,1fr)_auto]"
                  id={`request-${request.id}`}
                  key={request.id}
                  tabIndex={-1}
                >
                  {pet && (
                    <img
                      className="h-[100px] w-[90px] rounded-[13px] object-cover md:h-[135px] md:w-[145px]"
                      src={pet.image}
                      alt={pet.name}
                      width={145}
                      height={110}
                      loading="lazy"
                    />
                  )}
                  <div className="py-[7px]">
                    <div className="flex flex-col-reverse items-start justify-between gap-[15px] md:flex-row">
                      <div>
                        <span className="text-[9px] font-bold tracking-[0.08em] text-muted">
                          {request.id}
                        </span>
                        <h2 className="mb-2 mt-[3px] text-[27px]">
                          {pet ? pet.name : 'Pet indisponível'}
                        </h2>
                      </div>
                      <StatusPill status={request.status} />
                    </div>
                    <p className="text-xs text-muted">{request.message}</p>
                    <div className="flex flex-wrap gap-[18px] text-[10px] text-muted">
                      <span className="flex items-center gap-[5px]">
                        <CalendarDays size={16} /> Enviada em {formatRequestDate(request.date)}
                      </span>
                      {pet && (
                        <span className="flex items-center gap-[5px]">
                          <MapPin size={16} /> {pet.organization}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between md:col-span-1 md:flex-col md:items-end">
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
                        className="grid size-[38px] place-items-center rounded-[10px] border border-line text-forest-800"
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
      </Container>
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
    </PageSurface>
  )
}
