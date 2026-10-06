import { ClipboardList, PawPrint, Plus, SearchCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Card,
  Container,
  Feedback,
  LinkButton,
  PageIntro,
  PageSurface,
  StatusPill,
} from '../components/ui'
import { useOrganizationPets, useReceivedRequests } from '../hooks/useOrganization'
import { formatRequestDate } from '../utils/formatRequestDate'

export function OrganizationDashboardPage() {
  const petsQuery = useOrganizationPets()
  const requestsQuery = useReceivedRequests()

  if (petsQuery.isPending || requestsQuery.isPending)
    return <Feedback>Carregando painel...</Feedback>
  if (petsQuery.isError || requestsQuery.isError) {
    return <Feedback error>Não foi possível carregar o painel da instituição.</Feedback>
  }

  const pets = petsQuery.data
  const requests = requestsQuery.data
  const reviewing = requests.filter(
    ({ status }) => status === 'Enviada' || status === 'Em análise',
  ).length
  const approved = requests.filter(({ status }) => status === 'Aprovada').length

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <PageIntro
            eyebrow="Área da instituição"
            title="Painel de adoções"
            description="Gerencie os animais divulgados e acompanhe as pessoas interessadas em adotá-los."
          />
          <LinkButton to="/organizacao/pets/novo">
            <Plus size={18} /> Cadastrar pet
          </LinkButton>
        </div>

        <div className="my-8 grid gap-4 sm:grid-cols-3">
          <Metric icon={PawPrint} value={pets.length} label="Pets publicados" />
          <Metric icon={SearchCheck} value={reviewing} label="Aguardando decisão" />
          <Metric icon={ClipboardList} value={approved} label="Solicitações aprovadas" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="p-5 md:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-coral">
                  Fila recente
                </p>
                <h2 className="mb-0 mt-1 text-2xl">Solicitações recebidas</h2>
              </div>
              <Link className="text-xs font-bold text-forest-700" to="/organizacao/solicitacoes">
                Ver todas
              </Link>
            </div>
            {requests.length ? (
              <div className="grid gap-3">
                {requests.slice(0, 4).map((request) => (
                  <Link
                    key={request.id}
                    to="/organizacao/solicitacoes"
                    className="flex items-center gap-3 rounded-xl border border-line p-3 text-ink hover:bg-forest-50"
                  >
                    {request.pet && (
                      <img
                        src={request.pet.image}
                        alt=""
                        className="size-14 rounded-xl object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">
                        {request.adopter.name || 'Adotante'}
                      </strong>
                      <small className="text-muted">
                        {request.pet?.name ?? 'Pet indisponível'} ·{' '}
                        {formatRequestDate(request.date)}
                      </small>
                    </span>
                    <StatusPill status={request.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Ainda não há solicitações para os seus pets.</p>
            )}
          </Card>

          <Card className="p-5 md:p-7">
            <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-coral">
              Atalhos
            </p>
            <h2 className="mb-5 mt-1 text-2xl">O que deseja fazer?</h2>
            <div className="grid gap-3">
              <LinkButton to="/organizacao/pets" variant="secondary">
                Gerenciar meus pets
              </LinkButton>
              <LinkButton to="/organizacao/solicitacoes" variant="secondary">
                Analisar solicitações
              </LinkButton>
              <LinkButton to="/perfil?tipo=responsavel" variant="secondary">
                Editar perfil da instituição
              </LinkButton>
            </div>
          </Card>
        </div>
      </Container>
    </PageSurface>
  )
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof PawPrint
  value: number
  label: string
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="grid size-12 place-items-center rounded-2xl bg-forest-100 text-forest-800">
        <Icon size={23} />
      </span>
      <span>
        <strong className="block text-3xl font-display">{value}</strong>
        <small className="text-muted">{label}</small>
      </span>
    </Card>
  )
}
