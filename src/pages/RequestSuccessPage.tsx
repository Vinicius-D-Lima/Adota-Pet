import { Check, ClipboardList, Heart, Home } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { FlowSteps } from '../components/FlowSteps'
import { NotFoundState } from '../components/NotFoundState'
import { Container, Eyebrow, Feedback, LinkButton, PageSurface } from '../components/ui'
import { useAdoptionRequest } from '../hooks/useAdoptionRequests'
import { ApiError } from '../lib/ApiError'
import { formatRequestDate } from '../utils/formatRequestDate'

const RequestNotFound = () => (
  <NotFoundState
    title="Solicitação não encontrada"
    message="Esta solicitação não existe mais ou o endereço está incorreto."
    to="/solicitacoes"
    linkLabel="Ver minhas solicitações"
  />
)

const nextSteps = [
  ['Análise do perfil', 'A organização revisa seu perfil, compatibilidade e respostas.'],
  ['Uma boa conversa', 'Se houver interesse, vocês combinam uma conversa ou visita.'],
  ['Decisão responsável', 'Após as etapas, a organização registra a decisão no sistema.'],
]

export function RequestSuccessPage() {
  const { requestId } = useParams()
  const requestQuery = useAdoptionRequest(requestId)

  if (requestQuery.isPending) {
    return <Feedback>Carregando solicitação...</Feedback>
  }

  if (requestQuery.isError) {
    if (requestQuery.error instanceof ApiError && requestQuery.error.statusCode === 404) {
      return <RequestNotFound />
    }
    return <Feedback error>Não foi possível carregar a solicitação. Tente novamente.</Feedback>
  }

  const request = requestQuery.data
  const pet = request.pet
  if (!pet) return <RequestNotFound />

  return (
    <PageSurface className="bg-[linear-gradient(180deg,#edf5ee_0,#fbfaf6_55%)]">
      <Container as="section" className="max-w-[1080px] pb-[90px] pt-[35px] md:pt-[54px]">
        <FlowSteps current={3} />
        <div className="mx-auto max-w-[750px] rounded-3xl border border-line bg-white px-5 py-[34px] text-center shadow-soft md:p-[46px]">
          <span className="mx-auto mb-5 grid size-[66px] place-items-center rounded-full bg-forest-700 text-white shadow-[0_0_0_8px_var(--color-forest-100)]">
            <Check />
          </span>
          <Eyebrow>Solicitação enviada</Eyebrow>
          <h1 className="mb-[13px] text-[clamp(37px,4.6vw,52px)] leading-[1.08]">
            Agora é com a equipe que cuida de {pet.name}.
          </h1>
          <p className="mx-auto max-w-[590px] text-sm leading-[1.65] text-muted">
            Sua solicitação <strong>{request.id}</strong> foi enviada para {pet.organization}. Você
            pode acompanhar cada atualização pelo AdotaPet.
          </p>
          <div className="mx-auto my-[27px] flex max-w-[500px] items-center gap-3 rounded-[14px] bg-cream p-3 text-left">
            <img
              className="size-[52px] rounded-[11px] object-cover"
              src={pet.image}
              alt={pet.name}
              width={52}
              height={52}
              loading="lazy"
            />
            <div className="flex flex-col">
              <strong>{pet.name}</strong>
              <span className="text-[10px] text-muted">
                {pet.breed} · {pet.ageLabel}
              </span>
            </div>
            <span className="ml-auto hidden text-[10px] font-bold text-forest-700 sm:block">
              Enviada em {formatRequestDate(request.date)}
            </span>
          </div>
          <div className="border-t border-line pt-[25px] text-left">
            <h2 className="mb-4 font-sans text-[15px] tracking-normal">O que acontece agora?</h2>
            {nextSteps.map(([title, text], index) => (
              <div key={title} className="mt-[13px] flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-forest-100 text-[10px] font-bold text-forest-700">
                  {index + 1}
                </span>
                <p className="mb-0 flex flex-col text-[11px] leading-normal text-muted">
                  <strong className="text-xs text-ink">{title}</strong>
                  {text}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-[30px] flex flex-col justify-center gap-2.5 md:flex-row">
            <LinkButton to="/solicitacoes">
              <ClipboardList size={18} /> Acompanhar solicitação
            </LinkButton>
            <LinkButton variant="secondary" to="/pets">
              <Heart size={18} /> Continuar explorando
            </LinkButton>
          </div>
        </div>
        <Link
          className="mt-[22px] flex items-center justify-center gap-1.5 text-[11px] text-muted"
          to="/"
        >
          <Home size={16} /> Voltar para o início
        </Link>
      </Container>
    </PageSurface>
  )
}
