import { CalendarDays, ChevronRight, Mail, Phone, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  Badge,
  Card,
  Container,
  EmptyState,
  Feedback,
  Field,
  LinkButton,
  PageIntro,
  PageSurface,
  Select,
  StatusPill,
  cx,
} from '../components/ui'
import { useReceivedRequests } from '../hooks/useOrganization'
import type { ReceivedRequest } from '../types'
import { formatRequestDate } from '../utils/formatRequestDate'
import {
  ORGANIZATION_REQUEST_STAGES,
  countByStage,
  isOrganizationRequestStage,
} from '../utils/organizationRequestStage'

export function OrganizationRequestsPage() {
  const requestsQuery = useReceivedRequests()
  const [params, setParams] = useSearchParams()

  if (requestsQuery.isPending) return <Feedback>Carregando solicitações recebidas...</Feedback>
  if (requestsQuery.isError)
    return <Feedback error>Não foi possível carregar as solicitações recebidas.</Feedback>

  const requests = requestsQuery.data
  const stageFromUrl = params.get('estagio')
  const stageKey = isOrganizationRequestStage(stageFromUrl) ? stageFromUrl : 'all'
  const stage =
    ORGANIZATION_REQUEST_STAGES.find(({ key }) => key === stageKey) ??
    ORGANIZATION_REQUEST_STAGES[0]
  const petFromUrl = params.get('pet') ?? ''
  const counts = countByStage(requests)
  const pets = Array.from(
    new Map(
      requests
        .filter((request) => request.pet)
        .map((request) => [request.petId, request.pet!] as const),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const visible = requests
    .filter((request) => stage.matches(request))
    .filter((request) => !petFromUrl || request.petId === petFromUrl)

  const updateFilters = (nextStage: string, nextPet: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (nextStage === 'all') next.delete('estagio')
      else next.set('estagio', nextStage)
      if (!nextPet) next.delete('pet')
      else next.set('pet', nextPet)
      return next
    })
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <PageIntro
          eyebrow="Área da organização"
          title="Solicitações recebidas"
          description="Acompanhe cada etapa, agende entrevistas e decida com base no perfil e na compatibilidade de cada pessoa."
        />
        {requests.length ? (
          <>
            <div className="mb-7 grid gap-3 rounded-2xl border border-line bg-white p-3 md:grid-cols-[1fr_260px] md:items-end">
              <div
                className="flex gap-2 overflow-x-auto"
                role="group"
                aria-label="Filtrar solicitações por etapa"
              >
                {ORGANIZATION_REQUEST_STAGES.map((item) => {
                  const active = item.key === stage.key
                  const count = counts[item.key]
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${item.label}: ${count} ${count === 1 ? 'solicitação' : 'solicitações'}`}
                      onClick={() => updateFilters(item.key, petFromUrl)}
                      className={cx(
                        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-0 px-4 text-xs font-bold',
                        active
                          ? 'bg-forest-800 text-white'
                          : 'bg-transparent text-muted hover:bg-forest-50',
                      )}
                    >
                      <span>{item.label}</span>
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
              <Field label="Filtrar por pet" tight>
                <Select
                  value={petFromUrl}
                  onChange={(event) => updateFilters(stage.key, event.target.value)}
                >
                  <option value="">Todos os pets</option>
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-5">
              {visible.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
              {!visible.length && (
                <EmptyState
                  icon={<Search size={28} className="text-forest-700" />}
                  title="Nenhuma solicitação com estes filtros"
                  description="Mude a etapa ou o pet para ver outras solicitações."
                />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            title="Nenhuma solicitação recebida"
            description="As solicitações enviadas para os pets da organização aparecerão aqui."
          />
        )}
      </Container>
    </PageSurface>
  )
}

function RequestCard({ request }: { request: ReceivedRequest }) {
  return (
    <Card as="article" className="overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-[120px_1fr_auto] md:items-center md:p-6">
        {request.pet ? (
          <img
            src={request.pet.image}
            alt={request.pet.name}
            className="h-28 w-full rounded-2xl object-cover md:w-[120px]"
          />
        ) : (
          <div className="grid h-28 w-full place-items-center rounded-2xl bg-forest-50 text-xs text-muted md:w-[120px]">
            Pet indisponível
          </div>
        )}
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-coral">
            Solicitação {request.id}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-2xl">{request.pet?.name ?? 'Pet indisponível'}</h2>
            <StatusPill status={request.status} />
            {request.interview && (
              <Badge tone={request.interview.completed ? 'approved' : 'review'}>
                {request.interview.completed ? 'Entrevista realizada' : 'Entrevista agendada'}
              </Badge>
            )}
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
        <div className="flex md:justify-end">
          <LinkButton
            to={`/organizacao/solicitacoes/${encodeURIComponent(request.id)}`}
            variant="secondary"
            size="sm"
            aria-label={`Analisar solicitação ${request.id} de ${request.adopter.name || 'adotante'} para ${request.pet?.name ?? 'pet indisponível'}`}
          >
            Analisar solicitação <ChevronRight size={16} />
          </LinkButton>
        </div>
      </div>
    </Card>
  )
}
