import { Heart, PawPrint } from 'lucide-react'
import { useActiveOrganizationId, useOrganizationAdoptions } from '../hooks/useOrganization'
import { Card, Container, EmptyState, Feedback, PageIntro, PageSurface } from '../components/ui'

const adoptionDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

export function OrganizationAdoptionsPage() {
  const organizationId = useActiveOrganizationId()
  const adoptionsQuery = useOrganizationAdoptions(organizationId)

  if (adoptionsQuery.isPending) return <Feedback>Carregando adoções...</Feedback>
  if (adoptionsQuery.isError) {
    return <Feedback error>Não foi possível carregar as adoções.</Feedback>
  }

  const adoptions = adoptionsQuery.data

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <PageIntro
          eyebrow="Área da organização"
          title="Adoções"
          description="Acompanhe as adoções concluídas e os planos de acompanhamento."
        />
        {adoptions.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} />}
            title="Nenhuma adoção concluída"
            description="Quando uma solicitação for aprovada, ela aparecerá aqui."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {adoptions.map((adoption) => (
              <Card key={adoption.id} className="flex gap-4 p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-forest-100 text-forest-800">
                  <PawPrint size={22} />
                </span>
                <div className="min-w-0">
                  <strong className="block text-base">{adoption.pet?.name ?? 'Pet'}</strong>
                  <p className="mb-0 mt-1 text-xs text-muted">
                    Adotado em {adoptionDate(adoption.adoptedAt)}
                  </p>
                  {adoption.adopter?.name && (
                    <p className="mb-0 mt-1 text-xs text-muted">
                      Adotante: {adoption.adopter.name}
                    </p>
                  )}
                  {adoption.plan && (
                    <p className="mb-0 mt-2 text-xs font-semibold text-forest-700">
                      Acompanhamento: {adoption.plan.durationDays} dias, a cada{' '}
                      {adoption.plan.intervalDays} dias
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </PageSurface>
  )
}
