import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FlowSteps } from '../components/FlowSteps'
import { NotFoundState } from '../components/NotFoundState'
import {
  Alert,
  BackLink,
  Button,
  Card,
  Checkbox,
  Container,
  Eyebrow,
  Feedback,
  Field,
  FlowTitle,
  InfoNote,
  PageSurface,
  SectionHeading,
  Select,
  Textarea,
  cardClass,
  cx,
} from '../components/ui'
import {
  adoptionRequestKeys,
  fetchAdoptionRequests,
  useActiveRequestLookup,
  useCreateAdoptionRequest,
} from '../hooks/useAdoptionRequests'
import { useAdopterProfile } from '../hooks/useAdopterProfile'
import { usePet } from '../hooks/usePets'
import { ApiError } from '../lib/ApiError'
import { questionnaireSchema } from '../schemas/questionnaireSchema'
import type { QuestionnaireAnswers } from '../types'
import { profileFieldLabels } from '../utils/profileFieldLabels'
import { calculateProfileCompletion } from '../utils/profileCompletion'
import { isActiveRequest } from '../utils/requestStatus'

type FieldName = keyof QuestionnaireAnswers

const initialForm: QuestionnaireAnswers = {
  motivation: '',
  routine: '',
  aloneTime: 'Até 4 horas',
  adaptation: '',
  costs: false,
  commitment: false,
}

const GENERIC_ERROR = 'Não foi possível enviar a solicitação. Tente novamente.'
const ANSWERS_PREFIX = 'answers.'

const isFormField = (field: string): field is FieldName => field in initialForm

/** Remove o prefixo `answers.` dos campos do servidor e descarta o que não existe no formulário. */
function toFormErrors(error: ApiError): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {}
  for (const [field, message] of Object.entries(error.toFieldErrors())) {
    const name = field.startsWith(ANSWERS_PREFIX) ? field.slice(ANSWERS_PREFIX.length) : field
    if (isFormField(name)) errors[name] = message
  }
  return errors
}

/** Rótulos dos campos que faltam no perfil, a partir dos `details` do 422. */
function toMissingProfileFields(error: ApiError): string[] {
  const { details } = error
  if (!Array.isArray(details)) return []
  return details.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return []
    const { field, message } = item as { field?: unknown; message?: unknown }
    if (typeof field === 'string') return [profileFieldLabels[field] ?? field]
    return typeof message === 'string' ? [message] : []
  })
}

export function QuestionnairePage() {
  const { petId } = useParams()
  const petQuery = usePet(petId)
  const profileQuery = useAdopterProfile()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createRequest = useCreateAdoptionRequest()
  const { request: activeRequest, isFetching: isCheckingRequests } = useActiveRequestLookup(petId)
  // A mensagem de erro vale só para a versão do formulário que foi enviada: editar a esconde.
  const [failure, setFailure] = useState<{ message: ReactNode; values: unknown } | null>(null)
  const isSubmitting = createRequest.isPending

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<QuestionnaireAnswers>({
    resolver: zodResolver(questionnaireSchema),
    defaultValues: initialForm,
  })

  const values = useWatch({ control })

  const submitError = failure?.values === values ? failure.message : ''

  if (petQuery.isPending || profileQuery.isPending)
    return <Feedback>Carregando questionário...</Feedback>
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

  // Redireciona só quem ainda não começou a preencher e com a lista já atualizada. Quem digitou,
  // enviou ou está enviando nunca é desviado: perderia as respostas, e a própria solicitação nova
  // (ativa depois do envio) atropelaria a navegação para /enviada. O 409 do servidor cobre o resto.
  if (activeRequest && !isDirty && !isCheckingRequests) {
    return <Navigate to="/solicitacoes" replace />
  }

  const pet = petQuery.data
  const profile = profileQuery.data.profile
  const profileCompletion = calculateProfileCompletion('adopter', profile)

  if (!profileCompletion.isComplete) {
    return (
      <PageSurface>
        <Container as="section" className="max-w-[760px] pb-[90px] pt-[35px] md:pt-[54px]">
          <BackLink to={`/pets/${pet.id}`}>
            <ArrowLeft size={17} /> Voltar para os detalhes
          </BackLink>
          <Card className="mt-8 p-6 text-center md:p-10">
            <h1 className="mb-3 text-[34px]">Seu perfil precisa estar completo</h1>
            <p className="text-sm leading-6 text-muted">
              Você concluiu {profileCompletion.percentage}% do perfil. Complete os dados restantes
              antes de enviar uma solicitação para {pet.name}.
            </p>
            <p className="mx-auto max-w-[560px] text-xs text-muted">
              Faltam: {profileCompletion.missingFields.map(({ label }) => label).join(', ')}.
            </p>
            <Link
              className="mt-4 inline-flex font-bold text-coral-dark"
              to="/perfil"
              state={{ from: `/pets/${pet.id}/questionario` }}
            >
              Ir para o perfil
            </Link>
          </Card>
        </Container>
      </PageSurface>
    )
  }

  const describeFailure = async (error: unknown): Promise<ReactNode> => {
    if (!(error instanceof ApiError)) return GENERIC_ERROR

    if (error.statusCode === 400) {
      const fieldErrors = Object.entries(toFormErrors(error)) as [FieldName, string][]
      if (fieldErrors.length === 0) return GENERIC_ERROR
      for (const [field, message] of fieldErrors) setError(field, { type: 'server', message })
      return 'Revise os campos destacados e tente novamente.'
    }

    if (error.statusCode === 404) {
      return (
        <>
          Este pet não está mais disponível. <Link to="/pets">Ver outros pets</Link>
        </>
      )
    }

    if (error.statusCode === 409) {
      // A API não devolve o id da solicitação existente; ele é buscado na lista.
      const existing = await queryClient
        .fetchQuery({
          queryKey: adoptionRequestKeys.list(),
          queryFn: fetchAdoptionRequests,
          staleTime: 0,
        })
        .then((requests) =>
          requests.find((item) => item.petId === pet.id && isActiveRequest(item.status)),
        )
        .catch(() => undefined)
      return (
        <>
          Você já tem uma solicitação em andamento para {pet.name}
          {existing ? ` (${existing.id} · ${existing.status})` : ''}.{' '}
          <Link to="/solicitacoes">Ver minhas solicitações</Link>
        </>
      )
    }

    if (error.statusCode === 422) {
      const missing = toMissingProfileFields(error)
      return (
        <>
          Complete seu perfil para solicitar a adoção. <Link to="/perfil">Ir para o perfil</Link>
          {missing.length > 0 && (
            <>
              <br />
              Faltam: {missing.join(', ')}.
            </>
          )}
        </>
      )
    }

    return GENERIC_ERROR
  }

  const submit = handleSubmit(async (answers) => {
    if (isSubmitting) return
    setFailure(null)

    try {
      const request = await createRequest.mutateAsync({ petId: pet.id, answers })
      navigate(`/solicitacoes/${request.id}/enviada`)
    } catch (error) {
      setFailure({ message: await describeFailure(error), values })
    }
  })

  const sideItem = 'flex items-center gap-2 text-[11px] font-semibold text-forest-700'

  return (
    <PageSurface>
      <Container as="section" className="max-w-[1080px] pb-[90px] pt-[35px] md:pt-[54px]">
        <BackLink to={`/pets/${pet.id}/compatibilidade`}>
          <ArrowLeft size={17} /> Voltar para compatibilidade
        </BackLink>
        <FlowSteps current={2} />
        <FlowTitle
          compact
          eyebrow="Questionário de adoção"
          title={`Conte um pouco sobre a vida que você imagina com ${pet.name}.`}
          description={`Suas respostas ajudam ${pet.organization} a entender melhor sua rotina e suas expectativas.`}
        />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form
            className={cx(cardClass, 'px-[18px] py-[22px] md:p-[30px]')}
            onSubmit={submit}
            noValidate
          >
            <InfoNote className="mb-6">
              <p className="mb-0">
                <strong>Dados reaproveitados do seu perfil:</strong> {profile.name}, moradia{' '}
                {profile.housing.toLowerCase()} e disponibilidade de{' '}
                {profile.dailyTime.toLowerCase()}. Eles serão enviados junto com estas respostas e
                podem ser alterados em <Link to="/perfil">Meu perfil</Link>.
              </p>
            </InfoNote>
            <SectionHeading
              number={1}
              title="Sua motivação e rotina"
              description="Responda com sinceridade. Não existe resposta perfeita."
            />
            <Field
              label={`Por que você quer adotar ${pet.name}?`}
              hint={`${(values.motivation ?? '').length}/500 caracteres`}
              error={errors.motivation?.message}
              full
            >
              <Textarea
                maxLength={500}
                rows={5}
                invalid={Boolean(errors.motivation)}
                placeholder="Conte o que chamou sua atenção e o que espera dessa adoção..."
                {...register('motivation')}
              />
            </Field>
            <Field
              label="Como é um dia comum na sua casa?"
              hint={`${(values.routine ?? '').length}/500 caracteres`}
              error={errors.routine?.message}
              full
            >
              <Textarea
                maxLength={500}
                rows={5}
                invalid={Boolean(errors.routine)}
                placeholder="Fale sobre horários, pessoas em casa, passeios e atividades..."
                {...register('routine')}
              />
            </Field>
            <Field
              label="Por quanto tempo o pet ficaria sozinho?"
              error={errors.aloneTime?.message}
              full
            >
              <Select invalid={Boolean(errors.aloneTime)} {...register('aloneTime')}>
                <option>Até 2 horas</option>
                <option>Até 4 horas</option>
                <option>De 4 a 8 horas</option>
                <option>Mais de 8 horas</option>
              </Select>
            </Field>
            <SectionHeading
              separated
              number={2}
              title="Adaptação e compromisso"
              description="A adoção é um compromisso para toda a vida do animal."
            />
            <Field
              label="Como você pretende conduzir o período de adaptação?"
              hint={`${(values.adaptation ?? '').length}/350 caracteres`}
              error={errors.adaptation?.message}
              full
            >
              <Textarea
                maxLength={350}
                rows={4}
                invalid={Boolean(errors.adaptation)}
                placeholder="Conte sobre o espaço, a rotina inicial e a adaptação com outros moradores..."
                {...register('adaptation')}
              />
            </Field>
            <Checkbox
              label="Estou ciente dos custos recorrentes"
              description="Alimentação, vacinas, consultas, medicamentos e outros cuidados."
              error={errors.costs?.message}
              {...register('costs')}
            />
            <Checkbox
              label="Assumo o compromisso com o bem-estar do pet"
              description="Inclusive em mudanças de rotina, moradia ou composição familiar."
              error={errors.commitment?.message}
              {...register('commitment')}
            />
            {submitError && <Alert>{submitError}</Alert>}
            <div className="mt-[27px] flex flex-col justify-between gap-[15px] md:flex-row md:items-center">
              <span className="max-w-[260px] text-[9px] text-muted">
                Revise as respostas antes de enviar. Elas serão associadas ao seu perfil.
              </span>
              <Button type="submit" loading={isSubmitting} className="max-md:w-full">
                {isSubmitting ? 'Enviando...' : 'Revisar e enviar solicitação'}{' '}
                {!isSubmitting && <ArrowRight size={18} />}
              </Button>
            </div>
          </form>
          <Card
            as="aside"
            className="overflow-hidden md:max-lg:grid md:max-lg:grid-cols-[180px_1fr] lg:sticky lg:top-[100px]"
          >
            <img
              className="h-[210px] w-full object-cover md:max-lg:row-span-3 md:max-lg:h-full lg:h-[180px]"
              src={pet.image}
              alt={pet.name}
              width={400}
              height={300}
              loading="lazy"
            />
            <div className="px-5 pb-3 pt-5">
              <Eyebrow>Sua solicitação</Eyebrow>
              <h2 className="-mt-[7px] mb-0.5 text-[28px]">{pet.name}</h2>
              <p className="text-[11px] text-muted">
                {pet.breed} · {pet.ageLabel}
              </p>
            </div>
            <ul className="m-0 grid list-none gap-[11px] px-5 pb-[18px] pt-1">
              <li className={sideItem}>
                <CheckCircle2 size={16} /> Perfil preenchido
              </li>
              <li className={sideItem}>
                <CheckCircle2 size={16} /> Compatibilidade calculada
              </li>
              <li className={cx(sideItem, 'text-coral-dark')}>
                <span className="grid size-4 place-items-center rounded-full bg-coral text-[9px] text-white">
                  3
                </span>{' '}
                Questionário em andamento
              </li>
            </ul>
            <InfoNote className="mx-[15px] mb-[15px] md:max-lg:col-start-2">
              <p className="mb-0">
                Depois do envio, a organização poderá entrar em contato para conversar e agendar uma
                visita.
              </p>
            </InfoNote>
          </Card>
        </div>
      </Container>
    </PageSurface>
  )
}
