import { zodResolver } from '@hookform/resolvers/zod'
import {
  examInputSchema,
  healthConditionInputSchema,
  healthConditionTypes,
  neuteringInputSchema,
  vaccinationInputSchema,
  type CompleteMedicalRecord,
  type ExamInput,
  type HealthConditionInput,
  type NeuteringInput,
  type VaccinationInput,
} from '@adotapet/shared'
import { FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { MedicalRecordHistory } from '../components/MedicalRecordSection'
import { formatMedicalDate, isOverdue } from '../lib/medicalRecordFormat'
import {
  Alert,
  BackLink,
  Button,
  Checkbox,
  Container,
  Field,
  Feedback,
  Input,
  PageSurface,
  Select,
  Textarea,
  cardClass,
  cx,
} from '../components/ui'
import {
  isMedicalRecordForbidden,
  useMedicalRecord,
  useMedicalRecordMutations,
  useMedicalRecordPermission,
  type MedicalItemKind,
} from '../hooks/useMedicalRecord'

interface SaveArgs<T> {
  petId: string
  data: T
  itemId?: string
}

interface VaccinationItem {
  id: string
  name: string
  appliedAt: string
  nextDoseAt?: string | null
  batch?: string | null
  veterinarian?: string | null
}

interface ConditionItem {
  id: string
  name: string
  type: (typeof healthConditionTypes)[number]
  notes?: string
  careRequired: boolean
}

interface ExamItem {
  id: string
  type: string
  date: string
  result: string
}

const toIso = (value: string | null | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}
const toIsoOrNull = (value: string | null | undefined) => (value ? toIso(value) : null)
const toTextOrNull = (value: string | null | undefined) =>
  typeof value === 'string' && value.trim() ? value.trim() : null
const toDateTimeLocal = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16)
}
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'

function FormActions({ onCancel, label }: { onCancel: () => void; label: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button type="submit" loading={false}>
        {label}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  )
}

function VaccinationForm({
  petId,
  item,
  save,
  onDone,
}: {
  petId: string
  item?: VaccinationItem
  save: (args: SaveArgs<VaccinationInput>) => Promise<{ id: string }>
  onDone: () => void
}) {
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VaccinationInput>({
    resolver: zodResolver(vaccinationInputSchema) as Resolver<VaccinationInput>,
    defaultValues: {
      name: item?.name ?? '',
      appliedAt: toDateTimeLocal(item?.appliedAt),
      nextDoseAt: toDateTimeLocal(item?.nextDoseAt),
      batch: item?.batch ?? null,
      veterinarian: item?.veterinarian ?? null,
    },
  })

  const submit = handleSubmit(async (data) => {
    setError('')
    try {
      await save({ petId, data, itemId: item?.id })
      reset()
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  })

  return (
    <form className="mt-3 rounded-xl border border-line bg-cream p-4" onSubmit={submit} noValidate>
      <h4 className="mb-3 text-sm">{item ? 'Editar vacina' : 'Nova vacina'}</h4>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field full label="Nome" error={errors.name?.message}>
          <Input placeholder="Ex.: V10" invalid={Boolean(errors.name)} {...register('name')} />
        </Field>
        <Field label="Lote" error={errors.batch?.message}>
          <Input
            placeholder="Ex.: LOTE-10"
            invalid={Boolean(errors.batch)}
            {...register('batch', { setValueAs: toTextOrNull })}
          />
        </Field>
        <Field label="Data de aplicação" error={errors.appliedAt?.message}>
          <Input
            type="datetime-local"
            invalid={Boolean(errors.appliedAt)}
            {...register('appliedAt', { setValueAs: toIso })}
          />
        </Field>
        <Field label="Próxima dose" error={errors.nextDoseAt?.message}>
          <Input
            type="datetime-local"
            invalid={Boolean(errors.nextDoseAt)}
            {...register('nextDoseAt', { setValueAs: toIsoOrNull })}
          />
        </Field>
        <Field full label="Veterinário(a)" error={errors.veterinarian?.message}>
          <Input
            placeholder="Ex.: Dra. Ana"
            invalid={Boolean(errors.veterinarian)}
            {...register('veterinarian', { setValueAs: toTextOrNull })}
          />
        </Field>
      </div>
      <FormActions onCancel={onDone} label="Salvar vacina" />
    </form>
  )
}

function ConditionForm({
  petId,
  item,
  save,
  onDone,
}: {
  petId: string
  item?: ConditionItem
  save: (args: SaveArgs<HealthConditionInput>) => Promise<{ id: string }>
  onDone: () => void
}) {
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HealthConditionInput>({
    resolver: zodResolver(healthConditionInputSchema) as Resolver<HealthConditionInput>,
    defaultValues: {
      name: item?.name ?? '',
      type: item?.type ?? 'EM_TRATAMENTO',
      notes: item?.notes ?? '',
      careRequired: item?.careRequired ?? false,
    },
  })

  const submit = handleSubmit(async (data) => {
    setError('')
    try {
      await save({ petId, data, itemId: item?.id })
      reset()
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  })

  return (
    <form className="mt-3 rounded-xl border border-line bg-cream p-4" onSubmit={submit} noValidate>
      <h4 className="mb-3 text-sm">{item ? 'Editar condição' : 'Nova condição de saúde'}</h4>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nome" error={errors.name?.message}>
          <Input
            placeholder="Ex.: Alergia alimentar"
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <Field label="Tipo" error={errors.type?.message}>
          <Select invalid={Boolean(errors.type)} {...register('type')}>
            <option value="CRONICA">Crônica</option>
            <option value="EM_TRATAMENTO">Em tratamento</option>
            <option value="TRATADA">Tratada</option>
          </Select>
        </Field>
        <Field full label="Observações" error={errors.notes?.message}>
          <Textarea rows={3} placeholder="Orientações e histórico clínico" {...register('notes')} />
        </Field>
      </div>
      <Checkbox
        label="Requer cuidados necessários"
        description="Exibido como destaque no resumo de saúde do pet."
        {...register('careRequired')}
      />
      <FormActions onCancel={onDone} label="Salvar condição" />
    </form>
  )
}

function ExamForm({
  petId,
  item,
  save,
  upload,
  onDone,
}: {
  petId: string
  item?: ExamItem
  save: (args: SaveArgs<ExamInput>) => Promise<{ id: string }>
  upload: (args: { petId: string; examId: string; file: File }) => Promise<unknown>
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExamInput>({
    resolver: zodResolver(examInputSchema) as Resolver<ExamInput>,
    defaultValues: {
      type: item?.type ?? '',
      date: toDateTimeLocal(item?.date),
      result: item?.result ?? '',
    },
  })

  const submit = handleSubmit(async (data) => {
    setError('')
    try {
      const saved = await save({ petId, data, itemId: item?.id })
      if (file) await upload({ petId, examId: saved.id, file })
      reset()
      setFile(null)
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  })

  return (
    <form className="mt-3 rounded-xl border border-line bg-cream p-4" onSubmit={submit} noValidate>
      <h4 className="mb-3 text-sm">{item ? 'Editar exame' : 'Novo exame'}</h4>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Tipo de exame" error={errors.type?.message}>
          <Input
            placeholder="Ex.: Hemograma"
            invalid={Boolean(errors.type)}
            {...register('type')}
          />
        </Field>
        <Field label="Data do exame" error={errors.date?.message}>
          <Input
            type="datetime-local"
            invalid={Boolean(errors.date)}
            {...register('date', { setValueAs: toIso })}
          />
        </Field>
        <Field full label="Resultado" error={errors.result?.message}>
          <Textarea rows={3} placeholder="Descreva o resultado" {...register('result')} />
        </Field>
        <Field
          full
          label="Anexo do exame (PDF ou imagem)"
          hint="Enviado como URL assinada ao salvar."
        >
          <Input
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
      <FormActions onCancel={onDone} label="Salvar exame" />
    </form>
  )
}

function NeuteringForm({
  petId,
  record,
  save,
}: {
  petId: string
  record: CompleteMedicalRecord
  save: (args: SaveArgs<NeuteringInput>) => Promise<unknown>
}) {
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NeuteringInput>({
    resolver: zodResolver(neuteringInputSchema) as Resolver<NeuteringInput>,
    defaultValues: {
      done: record.neutering.done,
      date: toDateTimeLocal(record.neutering.date),
    },
  })

  const submit = handleSubmit(async (data) => {
    setError('')
    try {
      await save({ petId, data })
    } catch (cause) {
      setError(errorMessage(cause))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="mt-3 rounded-xl border border-line bg-white p-4">
      <h4 className="mb-2 text-sm">Castração</h4>
      {error && <Alert>{error}</Alert>}
      <Checkbox label="Pet castrado" {...register('done')} />
      <Field label="Data da castração" error={errors.date?.message}>
        <Input
          type="datetime-local"
          invalid={Boolean(errors.date)}
          {...register('date', { setValueAs: toIsoOrNull })}
        />
      </Field>
      <div className="mt-3">
        <Button type="submit">Salvar castração</Button>
      </div>
    </form>
  )
}

type OpenForm = 'vaccination' | 'condition' | 'exam' | null
interface EditingItem {
  kind: MedicalItemKind
  id: string
}

/** Edição completa do prontuário (#42), restrita a membros da organização do pet. */
export function OrganizationMedicalRecordPage() {
  const { petId } = useParams()
  const recordQuery = useMedicalRecord(petId)
  const { isOrganizationMember, isPending: isPermissionPending } = useMedicalRecordPermission(petId)
  const mutations = useMedicalRecordMutations()
  const [openForm, setOpenForm] = useState<OpenForm>(null)
  const [editing, setEditing] = useState<EditingItem | null>(null)
  const [actionError, setActionError] = useState('')

  if (!petId) return <Feedback error>Pet não encontrado.</Feedback>
  if (recordQuery.isPending || isPermissionPending)
    return <Feedback>Carregando prontuário...</Feedback>
  if (isMedicalRecordForbidden(recordQuery.error))
    return <Feedback error>Sem permissão para acessar este prontuário.</Feedback>
  if (recordQuery.isError || !recordQuery.data)
    return <Feedback error>Não foi possível carregar o prontuário.</Feedback>
  if (!isOrganizationMember)
    return (
      <Feedback error>
        Somente membros da organização responsável podem editar este prontuário.
      </Feedback>
    )

  const record = recordQuery.data
  if (record.complete !== true)
    return <Feedback error>Prontuário indisponível para edição.</Feedback>

  const closeForms = () => {
    setOpenForm(null)
    setEditing(null)
  }
  const startEdit = (kind: MedicalItemKind, id: string) => {
    setOpenForm(null)
    setEditing({ kind, id })
  }
  const remove = async (kind: MedicalItemKind, id: string) => {
    setActionError('')
    try {
      await mutations.removeItem.mutateAsync({ petId, kind, itemId: id })
      setEditing(null)
    } catch (cause) {
      setActionError(errorMessage(cause))
    }
  }

  const itemActions = (kind: MedicalItemKind, id: string) => (
    <div className="mt-2 flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => startEdit(kind, id)}>
        <Pencil size={14} /> Editar
      </Button>
      <Button variant="text-danger" size="sm" onClick={() => void remove(kind, id)}>
        <Trash2 size={14} /> Remover
      </Button>
    </div>
  )

  return (
    <PageSurface>
      <Container as="section" className="pb-20 pt-9 md:pt-12">
        <BackLink to={`/pets/${petId}`}>Voltar para o pet</BackLink>
        <div className="mb-6 mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[.12em] text-coral">
              Área da instituição
            </p>
            <h1 className="mb-1 text-3xl md:text-4xl">Prontuário do pet</h1>
            <p className="m-0 text-sm text-muted">
              Vacinas, condições, exames e castração. Alterações são registradas com usuário e data.
            </p>
          </div>
          {mutations.isPending && <span className="text-xs text-muted">Salvando...</span>}
        </div>
        {actionError && <Alert>{actionError}</Alert>}

        <div className={cx(cardClass, 'mx-auto max-w-[940px] space-y-8 p-6 md:p-8')}>
          <section aria-labelledby="edit-neutering-heading">
            <h2 id="edit-neutering-heading" className="text-xl">
              Castração
            </h2>
            <p className="text-sm text-muted">
              Situação atual: {record.neutering.done ? 'Castrado' : 'Não castrado'}
              {record.neutering.date ? ` em ${formatMedicalDate(record.neutering.date)}` : ''}
            </p>
            <NeuteringForm
              petId={petId}
              record={record}
              save={(args) => mutations.saveNeutering.mutateAsync(args)}
            />
          </section>

          <section aria-labelledby="edit-vaccinations-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="edit-vaccinations-heading" className="text-xl">
                Vacinas
              </h2>
              {openForm !== 'vaccination' && !editing?.kind && (
                <Button size="sm" onClick={() => setOpenForm('vaccination')}>
                  <Plus size={15} /> Adicionar vacina
                </Button>
              )}
            </div>
            <ul className="m-0 mt-3 list-none space-y-2 p-0">
              {record.vaccinations.map((vaccination) => (
                <li key={vaccination.id} className="rounded-xl border border-line p-3">
                  {editing?.kind === 'vaccinations' && editing.id === vaccination.id ? (
                    <VaccinationForm
                      petId={petId}
                      item={vaccination}
                      save={(args) => mutations.saveVaccination.mutateAsync(args)}
                      onDone={closeForms}
                    />
                  ) : (
                    <>
                      <strong className="block text-sm">{vaccination.name}</strong>
                      <span className="block text-xs text-muted">
                        Aplicada em {formatMedicalDate(vaccination.appliedAt)}
                      </span>
                      {vaccination.nextDoseAt && (
                        <span
                          className={cx(
                            'block text-xs',
                            isOverdue(vaccination.nextDoseAt)
                              ? 'font-bold text-coral'
                              : 'text-muted',
                          )}
                        >
                          Próxima dose: {formatMedicalDate(vaccination.nextDoseAt)}
                          {isOverdue(vaccination.nextDoseAt) && ' · Vencida'}
                        </span>
                      )}
                      {itemActions('vaccinations', vaccination.id)}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {openForm === 'vaccination' && (
              <VaccinationForm
                petId={petId}
                save={(args) => mutations.saveVaccination.mutateAsync(args)}
                onDone={closeForms}
              />
            )}
          </section>

          <section aria-labelledby="edit-conditions-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="edit-conditions-heading" className="text-xl">
                Condições de saúde
              </h2>
              {openForm !== 'condition' && !editing?.kind && (
                <Button size="sm" onClick={() => setOpenForm('condition')}>
                  <Plus size={15} /> Adicionar condição
                </Button>
              )}
            </div>
            <ul className="m-0 mt-3 list-none space-y-2 p-0">
              {record.healthConditions.map((condition) => (
                <li key={condition.id} className="rounded-xl border border-line p-3">
                  {editing?.kind === 'conditions' && editing.id === condition.id ? (
                    <ConditionForm
                      petId={petId}
                      item={condition}
                      save={(args) => mutations.saveCondition.mutateAsync(args)}
                      onDone={closeForms}
                    />
                  ) : (
                    <>
                      <strong className="block text-sm">{condition.name}</strong>
                      <span className="block text-xs text-muted">
                        {condition.type === 'CRONICA'
                          ? 'Crônica'
                          : condition.type === 'EM_TRATAMENTO'
                            ? 'Em tratamento'
                            : 'Tratada'}
                        {condition.careRequired && ' · Cuidados necessários'}
                      </span>
                      {condition.notes && (
                        <span className="block text-xs text-muted">
                          Observações: {condition.notes}
                        </span>
                      )}
                      {itemActions('conditions', condition.id)}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {openForm === 'condition' && (
              <ConditionForm
                petId={petId}
                save={(args) => mutations.saveCondition.mutateAsync(args)}
                onDone={closeForms}
              />
            )}
          </section>

          <section aria-labelledby="edit-exams-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="edit-exams-heading" className="text-xl">
                Exames
              </h2>
              {openForm !== 'exam' && !editing?.kind && (
                <Button size="sm" onClick={() => setOpenForm('exam')}>
                  <Plus size={15} /> Adicionar exame
                </Button>
              )}
            </div>
            <ul className="m-0 mt-3 list-none space-y-2 p-0">
              {record.exams.map((exam) => (
                <li key={exam.id} className="rounded-xl border border-line p-3">
                  {editing?.kind === 'exams' && editing.id === exam.id ? (
                    <ExamForm
                      petId={petId}
                      item={exam}
                      save={(args) => mutations.saveExam.mutateAsync(args)}
                      upload={(args) => mutations.uploadAttachment.mutateAsync(args)}
                      onDone={closeForms}
                    />
                  ) : (
                    <>
                      <strong className="block text-sm">{exam.type}</strong>
                      <span className="block text-xs text-muted">
                        {formatMedicalDate(exam.date)}
                      </span>
                      <span className="block text-xs text-muted">{exam.result}</span>
                      {exam.attachment?.url && (
                        <a
                          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-forest-700 underline"
                          href={exam.attachment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileUp size={13} /> Ver anexo
                        </a>
                      )}
                      {itemActions('exams', exam.id)}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {openForm === 'exam' && (
              <ExamForm
                petId={petId}
                save={(args) => mutations.saveExam.mutateAsync(args)}
                upload={(args) => mutations.uploadAttachment.mutateAsync(args)}
                onDone={closeForms}
              />
            )}
          </section>

          <MedicalRecordHistory record={record} />
        </div>
      </Container>
    </PageSurface>
  )
}
