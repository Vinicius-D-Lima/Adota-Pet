import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FlowSteps } from '../components/FlowSteps'
import { Field } from '../components/UI'
import {
  adoptionRequestKeys,
  fetchAdoptionRequests,
  useCreateAdoptionRequest,
} from '../hooks/useAdoptionRequests'
import { ApiError } from '../lib/ApiError'
import { questionnaireSchema } from '../schemas/questionnaireSchema'
import type { Pet, QuestionnaireAnswers } from '../types'
import { profileFieldLabels } from '../utils/profileFieldLabels'
import { isActiveRequest } from '../utils/requestStatus'
import { getZodFieldErrors, type FieldErrors } from '../utils/zodFieldErrors'

interface QuestionnairePageProps {
  pets: Pet[]
}

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
function toFormErrors(error: ApiError): FieldErrors<FieldName> {
  const errors: FieldErrors<FieldName> = {}
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

export function QuestionnairePage({ pets }: QuestionnairePageProps) {
  const { petId } = useParams()
  const pet = pets.find((item) => item.id === petId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createRequest = useCreateAdoptionRequest()
  const [form, setForm] = useState<QuestionnaireAnswers>(initialForm)
  const [errors, setErrors] = useState<FieldErrors<FieldName>>({})
  const [submitError, setSubmitError] = useState<ReactNode>('')
  const isSubmitting = createRequest.isPending

  if (!pet) return <Navigate to="/pets" replace />

  const update = <K extends FieldName>(key: K, value: QuestionnaireAnswers[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSubmitError('')
  }

  const describeFailure = async (error: unknown): Promise<ReactNode> => {
    if (!(error instanceof ApiError)) return GENERIC_ERROR

    if (error.statusCode === 400) {
      const fieldErrors = toFormErrors(error)
      if (Object.keys(fieldErrors).length === 0) return GENERIC_ERROR
      setErrors(fieldErrors)
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    const result = questionnaireSchema.safeParse(form)

    if (!result.success) {
      setErrors(getZodFieldErrors<FieldName>(result.error))
      return
    }

    setErrors({})
    setSubmitError('')

    try {
      const request = await createRequest.mutateAsync({ petId: pet.id, answers: result.data })
      navigate(`/solicitacoes/${request.id}/enviada`)
    } catch (error) {
      setSubmitError(await describeFailure(error))
    }
  }

  return (
    <div className="page-surface">
      <section className="container flow-page narrow-flow">
        <Link className="back-link" to={`/pets/${pet.id}/compatibilidade`}>
          <ArrowLeft size={17} /> Voltar para compatibilidade
        </Link>
        <FlowSteps current={2} />
        <div className="flow-title compact">
          <span className="eyebrow">Questionário de adoção</span>
          <h1>Conte um pouco sobre a vida que você imagina com {pet.name}.</h1>
          <p>
            Suas respostas ajudam {pet.organization} a entender melhor sua rotina e suas
            expectativas.
          </p>
        </div>
        <div className="questionnaire-layout">
          <form className="questionnaire-card" onSubmit={submit} noValidate>
            <div className="form-section-heading">
              <span>1</span>
              <div>
                <h2>Sua motivação e rotina</h2>
                <p>Responda com sinceridade. Não existe resposta perfeita.</p>
              </div>
            </div>
            <Field
              label={`Por que você quer adotar ${pet.name}?`}
              hint={`${form.motivation.length}/500 caracteres`}
              error={errors.motivation}
              full
            >
              <textarea
                maxLength={500}
                rows={5}
                value={form.motivation}
                onChange={(event) => update('motivation', event.target.value)}
                aria-invalid={Boolean(errors.motivation)}
                placeholder="Conte o que chamou sua atenção e o que espera dessa adoção..."
              />
            </Field>
            <Field
              label="Como é um dia comum na sua casa?"
              hint={`${form.routine.length}/500 caracteres`}
              error={errors.routine}
              full
            >
              <textarea
                maxLength={500}
                rows={5}
                value={form.routine}
                onChange={(event) => update('routine', event.target.value)}
                aria-invalid={Boolean(errors.routine)}
                placeholder="Fale sobre horários, pessoas em casa, passeios e atividades..."
              />
            </Field>
            <Field label="Por quanto tempo o pet ficaria sozinho?" error={errors.aloneTime} full>
              <select
                value={form.aloneTime}
                onChange={(event) =>
                  update('aloneTime', event.target.value as QuestionnaireAnswers['aloneTime'])
                }
                aria-invalid={Boolean(errors.aloneTime)}
              >
                <option>Até 2 horas</option>
                <option>Até 4 horas</option>
                <option>De 4 a 8 horas</option>
                <option>Mais de 8 horas</option>
              </select>
            </Field>
            <div className="form-section-heading second">
              <span>2</span>
              <div>
                <h2>Adaptação e compromisso</h2>
                <p>A adoção é um compromisso para toda a vida do animal.</p>
              </div>
            </div>
            <Field
              label="Como você pretende conduzir o período de adaptação?"
              hint={`${form.adaptation.length}/350 caracteres`}
              error={errors.adaptation}
              full
            >
              <textarea
                maxLength={350}
                rows={4}
                value={form.adaptation}
                onChange={(event) => update('adaptation', event.target.value)}
                aria-invalid={Boolean(errors.adaptation)}
                placeholder="Conte sobre o espaço, a rotina inicial e a adaptação com outros moradores..."
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={form.costs}
                onChange={(event) => update('costs', event.target.checked)}
                aria-invalid={Boolean(errors.costs)}
              />
              <span>
                <strong>Estou ciente dos custos recorrentes</strong>
                <small>Alimentação, vacinas, consultas, medicamentos e outros cuidados.</small>
                {errors.costs && <small className="check-error">{errors.costs}</small>}
              </span>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={form.commitment}
                onChange={(event) => update('commitment', event.target.checked)}
                aria-invalid={Boolean(errors.commitment)}
              />
              <span>
                <strong>Assumo o compromisso com o bem-estar do pet</strong>
                <small>Inclusive em mudanças de rotina, moradia ou composição familiar.</small>
                {errors.commitment && <small className="check-error">{errors.commitment}</small>}
              </span>
            </label>
            {submitError && (
              <div className="form-error" role="alert">
                <Info size={17} /> {submitError}
              </div>
            )}
            <div className="questionnaire-actions">
              <span>Suas respostas ficam salvas apenas nesta simulação.</span>
              <button className="button primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Revisar e enviar solicitação'}{' '}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </div>
          </form>
          <aside className="pet-side-summary">
            <img src={pet.image} alt={pet.name} />
            <div>
              <span className="eyebrow">Sua solicitação</span>
              <h2>{pet.name}</h2>
              <p>
                {pet.breed} · {pet.ageLabel}
              </p>
            </div>
            <ul>
              <li>
                <CheckCircle2 size={16} /> Perfil preenchido
              </li>
              <li>
                <CheckCircle2 size={16} /> Compatibilidade calculada
              </li>
              <li className="current">
                <span>3</span> Questionário em andamento
              </li>
            </ul>
            <div className="info-note">
              <Info size={17} />
              <p>
                Depois do envio, a organização poderá entrar em contato para conversar e agendar uma
                visita.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
