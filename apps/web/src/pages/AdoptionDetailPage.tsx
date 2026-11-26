import type { Adoption, CheckIn } from '@adotapet/shared'
import { ArrowLeft, CalendarDays, PawPrint } from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { CheckInCard } from '../components/CheckInCard'
import { CheckInForm } from '../components/CheckInForm'
import {
  BackLink,
  Button,
  Card,
  Container,
  EmptyState,
  Feedback,
  PageIntro,
  PageSurface,
} from '../components/ui'
import { adoptionKeys, useMyAdoptions } from '../hooks/useAdoptions'
import { isCheckInOverdue, sentCheckInCount, sortCheckIns } from '../utils/checkIns'

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

export function AdoptionDetailPage() {
  const { adoptionId = '' } = useParams()
  const queryClient = useQueryClient()
  const adoptionsQuery = useMyAdoptions()
  const [activeCheckInId, setActiveCheckInId] = useState<string | null>(null)
  const adoption = adoptionsQuery.data?.find((item) => item.id === adoptionId)
  const checkIns = adoption ? sortCheckIns(adoption.checkIns) : []

  const handleSubmitted = (updated: CheckIn) => {
    queryClient.setQueryData<Adoption[]>(adoptionKeys.mine, (current) =>
      current?.map((item) =>
        item.id === adoptionId
          ? {
              ...item,
              checkIns: item.checkIns.map((checkIn) =>
                checkIn.id === updated.id ? updated : checkIn,
              ),
            }
          : item,
      ),
    )
    setActiveCheckInId(null)
  }

  if (adoptionsQuery.isPending) return <Feedback>Carregando adoção...</Feedback>
  if (adoptionsQuery.isError) {
    return <Feedback error>Não foi possível carregar esta adoção.</Feedback>
  }
  if (!adoption) {
    return (
      <PageSurface>
        <Container as="section" className="py-16">
          <EmptyState
            icon={<PawPrint size={36} />}
            title="Adoção não encontrada"
            description="Ela pode não pertencer à sua conta."
          >
            <Link to="/adocoes">Voltar para minhas adoções</Link>
          </EmptyState>
        </Container>
      </PageSurface>
    )
  }

  const pending = checkIns.find(
    (checkIn) => checkIn.status === 'PENDENTE' || checkIn.status === 'ATRASADO',
  )
  const activeCheckIn =
    checkIns.find((checkIn) => checkIn.id === activeCheckInId) ??
    (activeCheckInId === null ? pending : undefined)

  return (
    <PageSurface>
      <Container as="section" className="pb-16 pt-10 md:pb-24 md:pt-14">
        <BackLink to="/adocoes">
          <ArrowLeft size={15} /> Minhas adoções
        </BackLink>

        <PageIntro
          eyebrow="Acompanhamento pós-adoção"
          title={adoption.pet?.name ?? 'Adoção'}
          description={`Adotado em ${formatDate(adoption.adoptedAt)}. ${sentCheckInCount(adoption.checkIns)} de ${adoption.checkIns.length} check-ins enviados.`}
        />

        {adoption.plan && (
          <Card className="mb-6 flex flex-wrap items-center gap-2 p-4 text-xs text-muted md:p-5">
            <CalendarDays size={16} className="text-forest-700" />
            Plano de acompanhamento: {adoption.plan.durationDays} dias, a cada{' '}
            {adoption.plan.intervalDays} dias.
          </Card>
        )}

        {checkIns.length === 0 ? (
          <EmptyState
            icon={<PawPrint size={36} />}
            title="Nenhum check-in combinado ainda"
            description="Quando a organização criar o plano de acompanhamento, os check-ins aparecem aqui."
          />
        ) : (
          <div className="grid gap-4">
            {checkIns.map((checkIn) => {
              const canSubmit = checkIn.status === 'PENDENTE' || checkIn.status === 'ATRASADO'
              const overdue = isCheckInOverdue(checkIn)

              return (
                <CheckInCard key={checkIn.id} checkIn={checkIn}>
                  {canSubmit &&
                    (activeCheckIn?.id === checkIn.id ? (
                      <CheckInForm checkIn={checkIn} onSubmitted={handleSubmitted} />
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          size="sm"
                          onClick={() => setActiveCheckInId(checkIn.id)}
                          variant={overdue ? 'danger' : 'primary'}
                        >
                          Enviar check-in
                        </Button>
                        <span className="text-[11px] text-muted">
                          Envie o relato e até 5 fotos desta etapa.
                        </span>
                      </div>
                    ))}
                </CheckInCard>
              )
            })}
          </div>
        )}
      </Container>
    </PageSurface>
  )
}
