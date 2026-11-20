import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Info,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PermissionGate } from '../components/PermissionGate'
import { RequestChat } from '../components/RequestChat'
import {
  Alert,
  Badge,
  BackLink,
  Button,
  Card,
  Container,
  Feedback,
  Field,
  Input,
  PageSurface,
  Select,
  StatusPill,
  Textarea,
  cx,
} from '../components/ui'
import {
  useCompleteInterview,
  useReceivedRequest,
  useScheduleInterview,
  useUpdateReceivedRequestStatus,
} from '../hooks/useOrganization'
import { ApiError } from '../lib/ApiError'
import { PERMISSIONS, usePermissions } from '../lib/permissions'
import {
  interviewFormSchema,
  interviewTypes,
  rejectionFormSchema,
  type InterviewFormData,
} from '@adotapet/shared'
import type { ReceivedRequest } from '../types'
import { formatDateTime, formatRequestDate } from '../utils/formatRequestDate'
import { calculateRequestCompatibility } from '../utils/requestCompatibility'

const levelTone = {
  Alta: 'bg-forest-100 text-forest-700',
  Média: 'bg-[#fff1d6] text-[#96620a]',
  Baixa: 'bg-[#fde8e1] text-[#ac4f32]',
} as const

const actionError = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.message ? error.message : fallback

export function OrganizationRequestDetailPage() {
  const { requestId } = useParams()
  const requestQuery = useReceivedRequest(requestId)
  const permissions = usePermissions()
  const transition = useUpdateReceivedRequestStatus()
  const scheduleInterview = useScheduleInterview()
  const completeInterview = useCompleteInterview()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectError, setRejectError] = useState('')
  const [chatOpen, setChatOpen] = useState(false)

  if (requestQuery.isPending) return <Feedback>Carregando solicitação...</Feedback>

  if (requestQuery.isError) {
    const notFound = requestQuery.error instanceof ApiError && requestQuery.error.statusCode === 404
    if (notFound) {
      return (
        <Feedback error>
          <div>
            <p>Solicitação não encontrada entre as recebidas pela organização.</p>
            <BackLink to="/organizacao/solicitacoes" className="mt-4">
              <ArrowLeft size={17} /> Voltar para as solicitações
            </BackLink>
          </div>
        </Feedback>
      )
    }
    return (
      <Feedback error>
        <div>
          <p>Não foi possível carregar a solicitação.</p>
          <Button variant="secondary" onClick={() => void requestQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </Feedback>
    )
  }

  const request = requestQuery.data
  const interviewDone = request.interview?.completed === true
  const canApprove = permissions.data?.canApprove ?? false
  const compatibility = calculateRequestCompatibility(request)

  const changeStatus = async (to: 'EM_ANALISE' | 'APROVADA' | 'RECUSADA', reason?: string) => {
    setError('')
    setNotice('')
    try {
      await transition.mutateAsync({ id: request.id, to, reason })
      setNotice(
        to === 'EM_ANALISE'
          ? 'Solicitação avançada para a entrevista.'
          : to === 'APROVADA'
            ? 'Adoção aprovada.'
            : 'Solicitação recusada.',
      )
      setRejectOpen(false)
      return true
    } catch (caught) {
      const message = actionError(caught, 'Não foi possível atualizar a solicitação.')
      if (to === 'RECUSADA') setRejectError(message)
      else setError(message)
      return false
    }
  }

  const proposeSlots = async (data: {
    type: InterviewFormData['type']
    proposedSlots: string[]
  }) => {
    setError('')
    setNotice('')
    try {
      await scheduleInterview.mutateAsync({ id: request.id, data })
      setNotice('Horários propostos. A pessoa adotante será avisada.')
    } catch (caught) {
      setError(actionError(caught, 'Não foi possível propor os horários.'))
    }
  }

  const markInterviewDone = async () => {
    setError('')
    setNotice('')
    try {
      await completeInterview.mutateAsync(request.id)
      setNotice('Entrevista marcada como realizada.')
    } catch (caught) {
      setError(actionError(caught, 'Não foi possível concluir a entrevista.'))
    }
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <BackLink to="/organizacao/solicitacoes">
          <ArrowLeft size={17} /> Voltar para as solicitações
        </BackLink>

        <RequestHeader request={request} />

        {notice && (
          <div
            className="mt-3.5 flex items-center gap-2 rounded-[9px] bg-forest-100 px-3.5 py-2.5 text-xs text-forest-800"
            role="status"
          >
            <CheckCircle2 size={17} /> {notice}
          </div>
        )}
        {error && <Alert>{error}</Alert>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="grid gap-6">
            <RequestActions
              request={request}
              canApprove={canApprove}
              interviewDone={interviewDone}
              busy={transition.isPending}
              onAdvance={() => void changeStatus('EM_ANALISE')}
              onApprove={() => void changeStatus('APROVADA')}
              onReject={() => {
                setRejectError('')
                setRejectOpen(true)
              }}
            />

            {request.status === 'Em análise' && (
              <InterviewSection
                interview={request.interview}
                interviewDone={interviewDone}
                busy={scheduleInterview.isPending || completeInterview.isPending}
                onPropose={proposeSlots}
                onComplete={() => void markInterviewDone()}
              />
            )}

            {request.status !== 'Em análise' &&
              request.status === 'Aprovada' &&
              request.interview && (
                <InterviewSection
                  interview={request.interview}
                  interviewDone={interviewDone}
                  busy={false}
                  onPropose={proposeSlots}
                  onComplete={() => void markInterviewDone()}
                />
              )}

            {request.status === 'Enviada' && (
              <Card as="section" className="p-5 md:p-6">
                <h2 className="mb-2 text-2xl">Entrevista</h2>
                <p className="m-0 text-sm text-muted">
                  Avance a solicitação para a entrevista para liberar a proposta de horários. Depois
                  de marcar a entrevista como realizada, a adoção poderá ser aprovada.
                </p>
              </Card>
            )}

            <QuestionnaireSection request={request} />
          </div>

          <div className="grid gap-6">
            <CompatibilitySection score={compatibility} />
            <AdopterProfile request={request} />
            <details
              className="rounded-[20px] border border-line bg-white p-5"
              onToggle={(event) => setChatOpen(event.currentTarget.open)}
            >
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-forest-800">
                <MessageCircle size={16} />
                Conversa com a pessoa adotante
                {(request.unreadMessageCount ?? 0) > 0 && (
                  <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] text-white">
                    {request.unreadMessageCount}
                  </span>
                )}
              </summary>
              {chatOpen && (
                <div className="mt-5">
                  <RequestChat requestId={request.id} status={request.status} />
                </div>
              )}
            </details>
          </div>
        </div>
      </Container>

      {rejectOpen && (
        <RejectDialog
          reasonError={rejectError}
          busy={transition.isPending}
          onClose={() => setRejectOpen(false)}
          onConfirm={async (reason) => {
            await changeStatus('RECUSADA', reason)
          }}
        />
      )}
    </PageSurface>
  )
}

function RequestHeader({ request }: { request: ReceivedRequest }) {
  return (
    <Card as="section" className="mt-2 overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-[140px_1fr] md:p-6">
        {request.pet ? (
          <img
            src={request.pet.image}
            alt={request.pet.name}
            className="h-36 w-full rounded-2xl object-cover md:w-[140px]"
          />
        ) : (
          <div className="grid h-36 w-full place-items-center rounded-2xl bg-forest-50 text-xs text-muted md:w-[140px]">
            Pet indisponível
          </div>
        )}
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-coral">
            Solicitação {request.id}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-3xl md:text-4xl">{request.pet?.name ?? 'Pet indisponível'}</h1>
            <StatusPill status={request.status} />
            {request.interview && (
              <Badge tone={request.interview.completed ? 'approved' : 'review'}>
                {request.interview.completed ? 'Entrevista realizada' : 'Entrevista agendada'}
              </Badge>
            )}
          </div>
          <p className="mb-1 text-sm font-bold text-forest-800">
            {request.adopter.name || 'Adotante'}
          </p>
          <p className="m-0 text-xs text-muted">
            {request.adopter.email} · {request.adopter.phone}
          </p>
          <p className="mb-0 mt-2 text-xs text-muted">
            Solicitação enviada em {formatRequestDate(request.date)}
          </p>
        </div>
      </div>
    </Card>
  )
}

function RequestActions({
  request,
  canApprove,
  interviewDone,
  busy,
  onAdvance,
  onApprove,
  onReject,
}: {
  request: ReceivedRequest
  canApprove: boolean
  interviewDone: boolean
  busy: boolean
  onAdvance: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const closed = ['Aprovada', 'Recusada', 'Cancelada'].includes(request.status)
  const canReview = ['Enviada', 'Em análise'].includes(request.status)

  return (
    <Card as="section" className="p-5 md:p-6">
      <h2 className="mb-2 text-2xl">Próximos passos</h2>
      {closed ? (
        <p className="m-0 text-sm text-muted">
          {request.status === 'Aprovada'
            ? 'Adoção aprovada. A pessoa adotante já pode combinar a entrega do pet.'
            : request.status === 'Recusada'
              ? `Solicitação recusada${request.rejectionReason ? `: ${request.rejectionReason}` : '.'}`
              : 'Solicitação cancelada pela pessoa adotante.'}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {request.status === 'Enviada'
              ? 'Revise o perfil e o questionário antes de iniciar a entrevista.'
              : 'A entrevista precisa estar marcada como realizada antes da aprovação.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {request.status === 'Enviada' && (
              <PermissionGate permission={PERMISSIONS.review}>
                <Button loading={busy} onClick={onAdvance}>
                  Avançar para entrevista
                </Button>
              </PermissionGate>
            )}

            {request.status === 'Em análise' && (
              <>
                <PermissionGate permission={PERMISSIONS.approve}>
                  <Button
                    loading={busy}
                    disabled={!interviewDone}
                    aria-describedby={!interviewDone ? 'approve-help' : undefined}
                    onClick={onApprove}
                  >
                    Aprovar adoção
                  </Button>
                </PermissionGate>
                {canApprove && !interviewDone && (
                  <p id="approve-help" className="m-0 flex items-center gap-2 text-xs text-muted">
                    <Info size={15} />
                    Marque a entrevista como realizada para liberar a aprovação.
                  </p>
                )}
              </>
            )}

            {canReview && (
              <PermissionGate permission={PERMISSIONS.reject}>
                <Button variant="danger" disabled={busy} onClick={onReject}>
                  <XCircle size={17} /> Recusar
                </Button>
              </PermissionGate>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

function InterviewSection({
  interview,
  interviewDone,
  busy,
  onPropose,
  onComplete,
}: {
  interview: ReceivedRequest['interview']
  interviewDone: boolean
  busy: boolean
  onPropose: (data: { type: InterviewFormData['type']; proposedSlots: string[] }) => Promise<void>
  onComplete: () => void
}) {
  if (!interview) {
    return (
      <Card as="section" className="p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-2xl">
          <CalendarClock size={22} className="text-forest-700" />
          Propor horários de entrevista ou visita
        </h2>
        <p className="mb-5 text-sm text-muted">
          Proponha de 1 a 3 horários futuros. A pessoa adotante escolherá um deles.
        </p>
        <PermissionGate permission={PERMISSIONS.review}>
          <InterviewForm busy={busy} onSubmit={onPropose} />
        </PermissionGate>
      </Card>
    )
  }

  return (
    <Card as="section" className="p-5 md:p-6">
      <h2 className="mb-1 flex items-center gap-2 text-2xl">
        <CalendarClock size={22} className="text-forest-700" />
        {interview.type}
      </h2>
      <Badge tone={interviewDone ? 'approved' : 'review'}>
        {interviewDone ? 'Realizada' : 'Aguardando realização'}
      </Badge>
      <ul className="mt-4 grid list-none gap-2 p-0 text-sm text-muted">
        {interview.proposedSlots.map((slot) => (
          <li key={slot} className="rounded-xl bg-forest-50 px-3 py-2">
            {formatDateTime(slot)}
          </li>
        ))}
      </ul>
      {interviewDone ? (
        <p className="mb-0 mt-4 flex items-center gap-2 text-sm text-forest-700">
          <CheckCircle2 size={17} />
          Entrevista realizada
          {interview.completedAt ? ` em ${formatDateTime(interview.completedAt)}` : ''}.
        </p>
      ) : (
        <PermissionGate permission={PERMISSIONS.review}>
          <Button className="mt-4" loading={busy} onClick={onComplete}>
            Marcar como realizado
          </Button>
        </PermissionGate>
      )}
    </Card>
  )
}

function InterviewForm({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (data: { type: InterviewFormData['type']; proposedSlots: string[] }) => Promise<void>
}) {
  const [type, setType] = useState<InterviewFormData['type']>('Entrevista online')
  const [slots, setSlots] = useState<string[]>([''])
  const [submitted, setSubmitted] = useState(false)
  const [minimumDate] = useState(() => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  })

  const validation = interviewFormSchema.safeParse({ type, slots })
  const slotMessages: Record<number, string> = {}
  let typeMessage = ''
  let formMessage = ''
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      if (issue.path[0] === 'type') typeMessage = issue.message
      else if (issue.path[0] === 'slots' && typeof issue.path[1] === 'number') {
        slotMessages[issue.path[1]] = issue.message
      } else formMessage = issue.message
    }
  }

  const updateSlot = (index: number, value: string) => {
    setSlots((current) => current.map((slot, position) => (position === index ? value : slot)))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    if (!validation.success) return
    await onSubmit({
      type,
      proposedSlots: slots.map((slot) => new Date(slot).toISOString()),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Tipo de encontro" error={submitted ? typeMessage : undefined}>
        <Select
          value={type}
          onChange={(event) => setType(event.target.value as InterviewFormData['type'])}
          invalid={submitted && Boolean(typeMessage)}
        >
          {interviewTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="m-0 grid gap-3 border-0 p-0">
        <legend className="mb-1 text-xs font-bold">Horários propostos</legend>
        {slots.map((slot, index) => {
          const message = submitted || slot ? slotMessages[index] : ''
          return (
            <div key={index} className="flex items-end gap-2">
              <Field label={`Horário ${index + 1}`} error={message} tight full>
                <Input
                  type="datetime-local"
                  min={minimumDate}
                  value={slot}
                  onChange={(event) => updateSlot(index, event.target.value)}
                  invalid={Boolean(message)}
                  aria-label={`Horário ${index + 1}`}
                />
              </Field>
              {slots.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Remover horário ${index + 1}`}
                  onClick={() =>
                    setSlots((current) => current.filter((_, position) => position !== index))
                  }
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          )
        })}
        {formMessage && <small className="text-[#a33f2d]">{formMessage}</small>}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={slots.length >= 3}
          onClick={() => setSlots((current) => [...current, ''])}
        >
          <Plus size={16} /> Adicionar horário
        </Button>
        <Button type="submit" loading={busy}>
          Propor horários
        </Button>
      </div>
    </form>
  )
}

function RejectDialog({
  reasonError,
  busy,
  onClose,
  onConfirm,
}: {
  reasonError: string
  busy: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const validation = rejectionFormSchema.safeParse({ reason })
  const message = validation.success
    ? ''
    : (validation.error.issues[0]?.message ?? 'Informe o motivo da recusa.')

  return (
    <ConfirmDialog
      title="Recusar solicitação"
      description="Explique o motivo. A pessoa adotante verá esta mensagem, então seja claro e respeitoso."
      confirmLabel="Recusar solicitação"
      busy={busy}
      confirmDisabled={!validation.success}
      initialFocusRef={textareaRef}
      onConfirm={() => void onConfirm(reason.trim())}
      onClose={onClose}
    >
      <div className="mt-5">
        <Field
          label="Motivo da recusa *"
          hint="Mínimo de 10 caracteres."
          error={reason ? message : undefined}
        >
          <Textarea
            ref={textareaRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            invalid={Boolean(reason && message)}
            rows={4}
            maxLength={500}
          />
        </Field>
        {reasonError && <Alert>{reasonError}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

function QuestionnaireSection({ request }: { request: ReceivedRequest }) {
  return (
    <Card as="section" className="p-5 md:p-6">
      <h2 className="mb-4 text-2xl">Questionário</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Answer label="Motivação" value={request.answers?.motivation} />
        <Answer label="Rotina" value={request.answers?.routine} />
        <Answer label="Tempo sozinho" value={request.answers?.aloneTime} />
        <Answer label="Adaptação" value={request.answers?.adaptation} />
        <Answer label="Custos assumidos" value={yesNo(request.answers?.costs)} />
        <Answer label="Compromisso assumido" value={yesNo(request.answers?.commitment)} />
      </div>
    </Card>
  )
}

function CompatibilitySection({
  score,
}: {
  score: ReturnType<typeof calculateRequestCompatibility>
}) {
  if (!score) {
    return (
      <Card as="section" className="p-5">
        <h2 className="mb-2 text-xl">Compatibilidade</h2>
        <p className="m-0 text-sm text-muted">
          Não foi possível calcular: o pet desta solicitação não está mais disponível.
        </p>
      </Card>
    )
  }

  return (
    <Card as="section" className="p-5 md:p-6">
      <h2 className="mb-3 flex items-center gap-2 text-xl">
        <Sparkles size={19} className="text-coral" /> Compatibilidade
      </h2>
      <div className="flex items-baseline gap-3">
        <strong className="font-display text-4xl text-forest-900">{score.score}%</strong>
        <span
          className={cx('rounded-full px-2.5 py-1 text-[10px] font-bold', levelTone[score.level])}
        >
          {score.level}
        </span>
      </div>
      <ul className="mt-4 grid list-none gap-2 p-0 text-xs leading-5">
        {score.good.map((item) => (
          <li key={item.good} className="flex gap-2 text-[#4d5f56]">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-forest-700" />
            {item.good}
          </li>
        ))}
        {score.attention.map((item) => (
          <li key={item.attention} className="flex gap-2 text-[#7d5a1a]">
            <Info size={15} className="mt-0.5 shrink-0" />
            {item.attention}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function AdopterProfile({ request }: { request: ReceivedRequest }) {
  const { adopter } = request
  return (
    <Card as="section" className="p-5 md:p-6">
      <h2 className="mb-4 text-xl">Perfil da pessoa adotante</h2>
      <dl className="m-0 grid gap-2 text-xs">
        <ProfileRow label="Completude" value={`${adopter.completion}%`} />
        <ProfileRow label="Moradia" value={adopter.housing} />
        <ProfileRow label="Área externa" value={yesNo(adopter.hasOutdoorArea)} />
        <ProfileRow label="Cidade" value={adopter.city} />
        <ProfileRow label="Endereço" value={adopter.address} />
        <ProfileRow label="Tempo diário" value={adopter.dailyTime} />
        <ProfileRow label="Nível de atividade" value={adopter.activityLevel} />
        <ProfileRow label="Experiência" value={adopter.experience} />
        <ProfileRow label="Crianças na casa" value={yesNo(adopter.hasChildren)} />
        <ProfileRow label="Outros pets" value={yesNo(adopter.hasOtherPets)} />
        <ProfileRow label="Cuidados especiais" value={yesNo(adopter.acceptsSpecialCare)} />
      </dl>
    </Card>
  )
}

function ProfileRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 text-right font-semibold text-ink">{value || 'Não informado'}</dd>
    </div>
  )
}

function Answer({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold">{label}</h3>
      <p className="m-0 whitespace-pre-line text-sm leading-6 text-muted">
        {value || 'Não informado'}
      </p>
    </div>
  )
}

function yesNo(value?: boolean) {
  return value === undefined ? undefined : value ? 'Sim' : 'Não'
}
