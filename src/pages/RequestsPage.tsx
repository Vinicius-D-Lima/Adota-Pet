import { CalendarDays, ChevronRight, ClipboardList, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  cx,
} from '../components/ui'
import { useAdoptionRequests, useCancelAdoptionRequest } from '../hooks/useAdoptionRequests'
import { ApiError } from '../lib/ApiError'
import type { AdoptionRequest, RequestStatus } from '../types'
import { formatRequestDate } from '../utils/formatRequestDate'
import { canCancelRequest } from '../utils/requestStatus'

const CANCEL_CONFLICT_MESSAGE =
  'Esta solicitação não pode mais ser cancelada porque o status dela mudou.'
const CANCEL_ERROR_MESSAGE = 'Não foi possível cancelar a solicitação. Tente novamente.'

const REQUEST_STAGES = [
  { key: 'all', label: 'Todas', statuses: null },
  { key: 'sent', label: 'Enviadas', statuses: ['Enviada'] },
  { key: 'review', label: 'Em análise', statuses: ['Em análise'] },
  { key: 'approved', label: 'Aprovadas', statuses: ['Aprovada'] },
  { key: 'closed', label: 'Encerradas', statuses: ['Recusada', 'Cancelada'] },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  statuses: readonly RequestStatus[] | null
}>

type RequestStage = (typeof REQUEST_STAGES)[number]['key']

const isRequestStage = (value: string | null): value is RequestStage =>
  REQUEST_STAGES.some((stage) => stage.key === value)

const inStage = (request: AdoptionRequest, stage: (typeof REQUEST_STAGES)[number]) =>
  stage.statuses === null || stage.statuses.some((status) => status === request.status)

export function RequestsPage() {
  const requestsQuery = useAdoptionRequests()
  const cancelRequest = useCancelAdoptionRequest()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const stageFromUrl = searchParams.get('estagio')
  const activeStageKey: RequestStage = isRequestStage(stageFromUrl) ? stageFromUrl : 'all'
  const activeStage = REQUEST_STAGES.find(({ key }) => key === activeStageKey) ?? REQUEST_STAGES[0]
  const visibleRequests = requests.filter((request) => inStage(request, activeStage))

  const selectStage = (stage: RequestStage) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (stage === 'all') next.delete('estagio')
      else next.set('estagio', stage)
      return next
    })
  }

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
          <div className="max-w-[930px]">
            <div
              className="mb-7 flex gap-2 overflow-x-auto rounded-2xl border border-line bg-white p-2 shadow-[0_8px_26px_rgba(30,60,48,0.05)]"
              role="group"
              aria-label="Filtrar solicitações por estágio"
            >
              {REQUEST_STAGES.map((stage) => {
                const count = requests.filter((request) => inStage(request, stage)).length
                const selected = stage.key === activeStage.key
                return (
                  <button
                    type="button"
                    className={cx(
                      'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-0 px-4 text-xs font-bold transition',
                      selected
                        ? 'bg-forest-800 text-white shadow-sm'
                        : 'bg-transparent text-muted hover:bg-forest-50 hover:text-forest-800',
                    )}
                    aria-pressed={selected}
                    aria-label={`${stage.label}: ${count} ${count === 1 ? 'solicitação' : 'solicitações'}`}
                    onClick={() => selectStage(stage.key)}
                    key={stage.key}
                  >
                    {stage.label}
                    <span
                      className={cx(
                        'grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[10px]',
                        selected ? 'bg-white/20 text-white' : 'bg-forest-100 text-forest-700',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-coral">
                  Estágio selecionado
                </p>
                <h2 className="m-0 text-[26px]">{activeStage.label}</h2>
              </div>
              <span className="text-xs text-muted">
                {visibleRequests.length}{' '}
                {visibleRequests.length === 1 ? 'solicitação' : 'solicitações'}
              </span>
            </div>

            <div className="grid gap-3.5" aria-live="polite">
              {visibleRequests.map((request) => {
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
              {!visibleRequests.length && (
                <EmptyState
                  icon={<ClipboardList size={36} />}
                  title={`Nenhuma solicitação em “${activeStage.label}”`}
                  description="Selecione outro estágio para acompanhar suas demais solicitações."
                />
              )}
            </div>
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
