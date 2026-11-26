import { AlertTriangle, CalendarHeart, Heart, PawPrint, RefreshCw } from 'lucide-react'
import { useMyAdoptions } from '../hooks/useAdoptions'
import { isCheckInOverdue, sentCheckInCount } from '../utils/checkIns'
import {
  Button,
  Card,
  Container,
  EmptyState,
  LinkButton,
  PageIntro,
  PageSurface,
} from '../components/ui'

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

export function MyAdoptionsPage() {
  const adoptionsQuery = useMyAdoptions()
  const adoptions = adoptionsQuery.data ?? []

  return (
    <PageSurface>
      <Container as="section" className="pb-16 pt-10 md:pb-24 md:pt-14">
        <PageIntro
          eyebrow="Seu lar, sua história"
          title="Minhas adoções"
          description="Acompanhe o progresso de cada adoção e envie os check-ins combinados com a organização."
        />

        {adoptionsQuery.isPending ? (
          <div className="grid gap-4" role="status" aria-label="Carregando adoções">
            <div className="h-44 animate-pulse rounded-[20px] border border-line bg-white" />
            <div className="h-44 animate-pulse rounded-[20px] border border-line bg-white" />
          </div>
        ) : adoptionsQuery.isError ? (
          <EmptyState
            icon={<Heart size={36} />}
            title="Não foi possível carregar suas adoções"
            description="Verifique sua conexão e tente novamente."
            role="alert"
          >
            <Button onClick={() => void adoptionsQuery.refetch()}>
              <RefreshCw size={16} /> Tentar novamente
            </Button>
          </EmptyState>
        ) : adoptions.length === 0 ? (
          <EmptyState
            icon={<Heart size={36} />}
            title="Você ainda não tem adoções concluídas"
            description="Quando uma solicitação for aprovada, o acompanhamento aparece aqui."
          >
            <LinkButton to="/pets">Encontrar pets</LinkButton>
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {adoptions.map((adoption) => {
              const total = adoption.checkIns.length
              const sent = sentCheckInCount(adoption.checkIns)
              const overdue = adoption.checkIns.filter((checkIn) =>
                isCheckInOverdue(checkIn),
              ).length
              const percent = total ? Math.round((sent / total) * 100) : 0

              return (
                <Card key={adoption.id} as="article" className="grid gap-4 p-5 md:p-6">
                  <div className="flex items-start gap-4">
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-forest-100 text-forest-800">
                      {adoption.pet?.image ? (
                        <img
                          src={adoption.pet.image}
                          alt={adoption.pet.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <PawPrint size={23} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="mb-1 text-xl">{adoption.pet?.name ?? 'Pet adotado'}</h2>
                      <p className="mb-0 flex items-center gap-1.5 text-xs text-muted">
                        <CalendarHeart size={15} /> Adotado em {formatDate(adoption.adoptedAt)}
                      </p>
                      {adoption.pet?.organization && (
                        <p className="mb-0 mt-1 text-xs text-muted">{adoption.pet.organization}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                      <span>
                        {sent} de {total} check-ins enviados
                      </span>
                      {overdue > 0 && (
                        <span className="inline-flex items-center gap-1 text-[#a94b32]">
                          <AlertTriangle size={14} /> {overdue} atrasado{overdue > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Progresso dos check-ins de ${adoption.pet?.name ?? 'pet'}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                      className="h-2 overflow-hidden rounded-full bg-forest-100"
                    >
                      <div
                        className="h-full rounded-full bg-forest-700"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <LinkButton to={`/adocoes/${adoption.id}`} variant="secondary" size="sm">
                    Ver acompanhamento
                  </LinkButton>
                </Card>
              )
            })}
          </div>
        )}
      </Container>
    </PageSurface>
  )
}
