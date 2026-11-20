import { AlertTriangle, ArrowLeft, ArrowRight, Check, Home, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ActiveRequestNotice } from '../components/ActiveRequestNotice'
import { FlowSteps } from '../components/FlowSteps'
import { NotFoundState } from '../components/NotFoundState'
import {
  BackLink,
  Button,
  Card,
  Container,
  Feedback,
  FlowTitle,
  InfoNote,
  LinkButton,
  PageSurface,
  cx,
} from '../components/ui'
import { useAdopterProfile } from '../hooks/useAdopterProfile'
import { useActiveRequestForPet } from '../hooks/useAdoptionRequests'
import { usePet } from '../hooks/usePets'
import { ApiError } from '../lib/ApiError'
import { calculateCompatibility } from '../utils/calculateCompatibility'
import { calculateProfileCompletion } from '../utils/profileCompletion'

const levelTone = {
  Alta: 'bg-forest-100 text-forest-700',
  Média: 'bg-[#fff1d6] text-[#96620a]',
  Baixa: 'bg-[#fde8e1] text-[#ac4f32]',
} as const

const summaryRow =
  'mt-5 flex w-full items-center gap-2.5 border-t border-line pt-[19px] text-left max-md:mt-0 max-md:pt-2.5'

interface CriteriaCardProps {
  icon: ReactNode
  title: string
  subtitle: ReactNode
  tone: 'good' | 'attention'
  children: ReactNode
}

function CriteriaCard({ icon, title, subtitle, tone, children }: CriteriaCardProps) {
  return (
    <Card as="section" className="p-[25px]">
      <div className="flex items-center gap-[13px]">
        <span
          className={cx(
            'grid size-[42px] place-items-center rounded-xl',
            tone === 'good' ? 'bg-forest-100 text-forest-700' : 'bg-[#fff1dc] text-[#ba7716]',
          )}
        >
          {icon}
        </span>
        <div>
          <h2 className="mb-0.5 font-sans text-[17px] tracking-[-0.02em]">{title}</h2>
          <p className="mb-0 text-[11px] text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

function CriteriaList({ items, icon }: { items: string[]; icon: ReactNode }) {
  return (
    <ul className="mt-5 grid list-none gap-3 p-0">
      {items.map((text) => (
        <li
          key={text}
          className="flex items-start gap-[9px] text-[13px] leading-normal text-[#4d5f56]"
        >
          <span className="mt-0.5 shrink-0">{icon}</span>
          {text}
        </li>
      ))}
    </ul>
  )
}

export function CompatibilityPage() {
  const { petId } = useParams()
  const petQuery = usePet(petId)
  const profileQuery = useAdopterProfile()
  const activeRequest = useActiveRequestForPet(petId)

  if (petQuery.isPending || profileQuery.isPending) {
    return <Feedback>Carregando compatibilidade...</Feedback>
  }
  if (petQuery.isError) {
    const notFound = petQuery.error instanceof ApiError && petQuery.error.statusCode === 404
    if (notFound) {
      return (
        <NotFoundState
          title="Pet não encontrado"
          message="Este pet não está mais disponível ou o endereço está incorreto."
          to="/pets"
          linkLabel="Ver outros pets"
        />
      )
    }
    return (
      <Feedback error>
        <div>
          <p>Não foi possível carregar o pet.</p>
          <Button variant="secondary" onClick={() => void petQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </Feedback>
    )
  }

  if (profileQuery.isError) {
    return (
      <Feedback error>
        <div>
          <p>Não foi possível carregar seu perfil.</p>
          <Button variant="secondary" onClick={() => void profileQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </Feedback>
    )
  }

  const pet = petQuery.data
  const { profile } = profileQuery.data
  const profileCompletion = calculateProfileCompletion('adopter', profile)

  if (!profileCompletion.isComplete) {
    return (
      <PageSurface>
        <Container as="section" className="max-w-[760px] pb-[90px] pt-[35px] md:pt-[54px]">
          <BackLink to={`/pets/${pet.id}`}>
            <ArrowLeft size={17} /> Voltar para os detalhes
          </BackLink>
          <Card className="mt-8 p-6 text-center md:p-10">
            <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-[#fff1dc] text-[#ba7716]">
              <AlertTriangle size={26} />
            </span>
            <h1 className="mb-3 text-[34px]">Complete seu perfil para ver a compatibilidade</h1>
            <p className="mx-auto max-w-[580px] text-sm leading-6 text-muted">
              Seu perfil está {profileCompletion.percentage}% completo. Precisamos das informações
              restantes para calcular um resultado confiável, sem assumir respostas por você.
            </p>
            <div className="mx-auto my-6 max-w-[520px] rounded-xl bg-cream p-4 text-left">
              <strong className="text-sm">Campos que ainda faltam:</strong>
              <ul className="mb-0 mt-3 grid gap-2 pl-5 text-xs text-muted sm:grid-cols-2">
                {profileCompletion.missingFields.map(({ key, label }) => (
                  <li key={key}>{label}</li>
                ))}
              </ul>
            </div>
            <LinkButton to="/perfil" state={{ from: `/pets/${pet.id}/compatibilidade` }}>
              Completar meu perfil <ArrowRight size={18} />
            </LinkButton>
          </Card>
        </Container>
      </PageSurface>
    )
  }
  const result = calculateCompatibility(pet, profile)

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <BackLink to={`/pets/${pet.id}`}>
          <ArrowLeft size={17} /> Voltar para os detalhes
        </BackLink>
        <FlowSteps current={1} />
        <FlowTitle
          eyebrow={
            <>
              <Sparkles size={15} /> Avaliação orientativa
            </>
          }
          title={
            <>
              Você e {pet.name} têm uma compatibilidade <em>{result.level.toLowerCase()}</em>.
            </>
          }
          description="Comparamos as informações do seu perfil com as necessidades deste pet."
        />
        <div className="grid items-start gap-[26px] md:grid-cols-[270px_minmax(0,1fr)] lg:grid-cols-[310px_minmax(0,1fr)]">
          <Card
            as="aside"
            className="grid justify-items-center px-[23px] py-7 text-center sm:max-md:grid-cols-[145px_1fr] sm:max-md:items-center sm:max-md:justify-items-start sm:max-md:gap-x-5 sm:max-md:gap-y-2.5 sm:max-md:text-left md:block"
          >
            <div
              className="relative mx-auto mb-[18px] grid size-[135px] place-items-center rounded-full after:absolute after:inset-[11px] after:rounded-full after:bg-white after:content-[''] sm:max-md:row-span-4 sm:max-md:m-0 md:size-[165px]"
              style={{
                background: `conic-gradient(var(--color-coral) ${result.score * 3.6}deg, #e8ece8 0)`,
              }}
            >
              <div className="relative z-10 flex flex-col">
                <strong className="font-display text-[37px] leading-none md:text-[44px]">
                  {result.score}%
                </strong>
                <span className="mt-1 text-[11px] text-muted">compatível</span>
              </div>
            </div>
            <span
              className={cx(
                'inline-block rounded-full px-[11px] py-[7px] text-[11px] font-bold',
                levelTone[result.level],
              )}
            >
              Compatibilidade {result.level.toLowerCase()}
            </span>
            <div className={summaryRow}>
              <img
                className="size-12 rounded-xl object-cover"
                src={pet.image}
                alt={pet.name}
                width={48}
                height={48}
                loading="lazy"
              />
              <span className="flex flex-col">
                <strong className="text-[13px]">{pet.name}</strong>
                <small className="mt-0.5 text-[10px] text-muted">
                  {pet.breed} · {pet.ageLabel}
                </small>
              </span>
            </div>
            <div className={summaryRow}>
              <Home size={17} className="text-forest-700" />
              <span className="flex flex-col">
                <strong className="text-[13px]">Seu perfil</strong>
                <small className="mt-0.5 text-[10px] text-muted">
                  {profile.housing} · rotina {profile.activityLevel.toLowerCase()}
                </small>
              </span>
              <Link to="/perfil" className="ml-auto text-[11px] font-bold text-coral-dark">
                Editar
              </Link>
            </div>
          </Card>
          <div className="grid gap-4">
            <CriteriaCard
              tone="good"
              icon={<Check />}
              title="Pontos que combinam"
              subtitle={`${result.good.length} critérios atendidos`}
            >
              <CriteriaList
                items={result.good.map((item) => item.good)}
                icon={<Check size={17} className="text-forest-700" />}
              />
            </CriteriaCard>
            <CriteriaCard
              tone="attention"
              icon={<AlertTriangle />}
              title="Pontos para conversar"
              subtitle={`${result.attention.length || 'Nenhum'} ${
                result.attention.length === 1 ? 'ponto de atenção' : 'pontos de atenção'
              }`}
            >
              {result.attention.length ? (
                <CriteriaList
                  items={result.attention.map((item) => item.attention)}
                  icon={<AlertTriangle size={17} className="text-[#ba7716]" />}
                />
              ) : (
                <p className="mb-0 mt-[18px] text-[13px] text-muted">
                  Seu perfil atende a todos os critérios avaliados para este pet.
                </p>
              )}
            </CriteriaCard>
            <InfoNote>
              <p className="mb-0">
                <strong>Este resultado não é uma decisão automática.</strong> A organização
                responsável analisará seu perfil e as respostas do questionário antes de aprovar a
                adoção.
              </p>
            </InfoNote>
            <div className="mt-2 flex flex-col-reverse justify-end gap-2.5 md:flex-row">
              <LinkButton variant="secondary" to={`/pets/${pet.id}`}>
                Rever detalhes
              </LinkButton>
              {!activeRequest && (
                <LinkButton to={`/pets/${pet.id}/questionario`}>
                  Continuar para o questionário <ArrowRight size={18} />
                </LinkButton>
              )}
            </div>
            {activeRequest && <ActiveRequestNotice request={activeRequest} petName={pet.name} />}
          </div>
        </div>
      </Container>
    </PageSurface>
  )
}
