import { CalendarDays, Mail, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Container,
  EmptyState,
  Feedback,
  PageIntro,
  PageSurface,
  StatusPill,
  cx,
} from '../components/ui'
import { useReceivedRequests, useUpdateReceivedRequestStatus } from '../hooks/useOrganization'
import type { ReceivedRequest, RequestStatus } from '../types'
import { formatRequestDate } from '../utils/formatRequestDate'

const stages = [
  { key: 'all', label: 'Todas', statuses: null },
  { key: 'sent', label: 'Novas', statuses: ['Enviada'] },
  { key: 'review', label: 'Em análise', statuses: ['Em análise'] },
  { key: 'approved', label: 'Aprovadas', statuses: ['Aprovada'] },
  { key: 'declined', label: 'Recusadas', statuses: ['Recusada', 'Cancelada'] },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  statuses: readonly RequestStatus[] | null
}>

type Stage = (typeof stages)[number]['key']
const isStage = (value: string | null): value is Stage => stages.some(({ key }) => key === value)
const matches = (request: ReceivedRequest, stage: (typeof stages)[number]) =>
  !stage.statuses || stage.statuses.includes(request.status as never)

export function OrganizationRequestsPage() {
  const requestsQuery = useReceivedRequests()
  const updateStatus = useUpdateReceivedRequestStatus()
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState('')

  if (requestsQuery.isPending) return <Feedback>Carregando solicitações recebidas...</Feedback>
  if (requestsQuery.isError)
    return <Feedback error>Não foi possível carregar as solicitações recebidas.</Feedback>

  const selectedKey: Stage = isStage(params.get('estagio'))
    ? (params.get('estagio') as Stage)
    : 'all'
  const selected = stages.find(({ key }) => key === selectedKey) ?? stages[0]
  const visible = requestsQuery.data.filter((request) => matches(request, selected))
  const change = async (id: string, to: 'EM_ANALISE' | 'APROVADA' | 'RECUSADA') => {
    setError('')
    try {
      await updateStatus.mutateAsync({ id, to })
    } catch {
      setError('Não foi possível atualizar a solicitação. Recarregue a página e tente novamente.')
    }
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <PageIntro
          eyebrow="Área da instituição"
          title="Solicitações recebidas"
          description="Analise o perfil e o questionário de cada pessoa antes de avançar no processo de adoção."
        />
        {error && <Alert>{error}</Alert>}
        {requestsQuery.data.length ? (
          <>
            <div
              className="mb-7 flex gap-2 overflow-x-auto rounded-2xl border border-line bg-white p-2"
              role="group"
              aria-label="Filtrar solicitações por estágio"
            >
              {stages.map((stage) => {
                const count = requestsQuery.data.filter((request) => matches(request, stage)).length
                const active = stage.key === selected.key
                return (
                  <button
                    key={stage.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setParams(stage.key === 'all' ? {} : { estagio: stage.key })}
                    className={cx(
                      'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-0 px-4 text-xs font-bold',
                      active
                        ? 'bg-forest-800 text-white'
                        : 'bg-transparent text-muted hover:bg-forest-50',
                    )}
                  >
                    <span>{stage.label}</span>
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-[10px]',
                        active ? 'bg-white/20' : 'bg-forest-100 text-forest-700',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="grid gap-5">
              {visible.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  pending={updateStatus.isPending && updateStatus.variables?.id === request.id}
                  onChange={change}
                />
              ))}
              {!visible.length && (
                <EmptyState
                  title="Nenhuma solicitação neste estágio"
                  description="Quando uma solicitação mudar para este estágio, ela aparecerá aqui."
                />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            title="Nenhuma solicitação recebida"
            description="As solicitações enviadas para os pets da instituição aparecerão aqui."
          />
        )}
      </Container>
    </PageSurface>
  )
}

function RequestCard({
  request,
  pending,
  onChange,
}: {
  request: ReceivedRequest
  pending: boolean
  onChange: (id: string, to: 'EM_ANALISE' | 'APROVADA' | 'RECUSADA') => Promise<void>
}) {
  return (
    <Card as="article" className="overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-[120px_1fr_auto] md:p-6">
        {request.pet && (
          <img
            src={request.pet.image}
            alt={request.pet.name}
            className="h-28 w-full rounded-2xl object-cover md:w-[120px]"
          />
        )}
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="m-0 text-2xl">{request.pet?.name ?? 'Pet indisponível'}</h2>
            <StatusPill status={request.status} />
          </div>
          <p className="mb-2 text-sm font-bold text-forest-800">
            {request.adopter.name || 'Adotante'}
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <CalendarDays size={15} /> {formatRequestDate(request.date)}
            </span>
            <span className="flex items-center gap-1">
              <Mail size={15} /> {request.adopter.email}
            </span>
            <span className="flex items-center gap-1">
              <Phone size={15} /> {request.adopter.phone}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2 md:justify-end">
          {request.status === 'Enviada' && (
            <Button size="sm" loading={pending} onClick={() => onChange(request.id, 'EM_ANALISE')}>
              Iniciar análise
            </Button>
          )}
          {request.status === 'Em análise' && (
            <Button size="sm" loading={pending} onClick={() => onChange(request.id, 'APROVADA')}>
              Aprovar
            </Button>
          )}
          {['Enviada', 'Em análise'].includes(request.status) && (
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => onChange(request.id, 'RECUSADA')}
            >
              Recusar
            </Button>
          )}
        </div>
      </div>
      <details className="border-t border-line px-5 py-4 md:px-6">
        <summary className="cursor-pointer text-xs font-bold text-forest-800">
          <UserRound size={16} className="mr-2 inline" />
          Ver perfil e questionário do adotante
        </summary>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section>
            <h3 className="mb-3 text-lg">Perfil</h3>
            <Info label="Completude" value={`${request.adopter.completion}%`} />
            <Info label="Moradia" value={request.adopter.housing} />
            <Info label="Tempo diário" value={request.adopter.dailyTime} />
            <Info label="Experiência" value={request.adopter.experience} />
            <Info label="Crianças na casa" value={yesNo(request.adopter.hasChildren)} />
            <Info label="Outros pets" value={yesNo(request.adopter.hasOtherPets)} />
          </section>
          <section>
            <h3 className="mb-3 text-lg">Questionário</h3>
            <Info label="Motivação" value={request.answers?.motivation} />
            <Info label="Rotina" value={request.answers?.routine} />
            <Info label="Tempo sozinho" value={request.answers?.aloneTime} />
            <Info label="Adaptação" value={request.answers?.adaptation} />
          </section>
        </div>
      </details>
    </Card>
  )
}

function yesNo(value?: boolean) {
  return value === undefined ? undefined : value ? 'Sim' : 'Não'
}
function Info({ label, value }: { label: string; value?: string }) {
  return (
    <p className="mb-2 text-xs leading-5">
      <strong>{label}:</strong> <span className="text-muted">{value || 'Não informado'}</span>
    </p>
  )
}
