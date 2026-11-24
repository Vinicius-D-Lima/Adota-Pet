import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Container,
  Field,
  InfoNote,
  Input,
  PageSurface,
  Select,
  TextLink,
  Textarea,
} from '../components/ui'
import { useCreateReport } from '../hooks/useReports'
import { ApiError } from '../lib/ApiError'
import {
  reportCategories,
  reportSchema,
  reportTargetTypes,
  validateReportAttachments,
  type ReportFormData,
} from '@adotapet/shared'

const targetLabels: Record<(typeof reportTargetTypes)[number], string> = {
  USUARIO: 'Usuário',
  ORGANIZACAO: 'Organização',
  ADOCAO: 'Adoção',
  PET: 'Pet',
  AVALIACAO: 'Avaliação',
}

const categoryLabels: Record<(typeof reportCategories)[number], string> = {
  MAUS_TRATOS: 'Maus-tratos',
  ABANDONO: 'Abandono',
  FRAUDE: 'Fraude',
  CONTEUDO_IMPROPRIO: 'Conteúdo impróprio',
  OUTRO: 'Outro',
}

const readTargetType = (value: string | null): ReportFormData['targetType'] =>
  reportTargetTypes.find((type) => type === value) ?? 'PET'

export function ReportPage() {
  const createReport = useCreateReport()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<{
    targetType: ReportFormData['targetType']
    targetId: string
    category: string
    description: string
  }>({
    targetType: readTargetType(searchParams.get('targetType')),
    targetId: searchParams.get('targetId') ?? '',
    category: '',
    description: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [validationMessage, setValidationMessage] = useState('')
  const [submissionError, setSubmissionError] = useState('')

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
    setValidationMessage('')
    setSubmissionError('')
    createReport.reset()
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    const nextFiles = [...files, ...selected]
    setAttachmentError(validateReportAttachments(nextFiles))
    if (!validateReportAttachments(nextFiles)) setFiles(nextFiles)
    event.target.value = ''
  }

  const removeFile = (fileToRemove: File) => {
    const nextFiles = files.filter((file) => file !== fileToRemove)
    setFiles(nextFiles)
    setAttachmentError(validateReportAttachments(nextFiles))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationMessage('')
    setSubmissionError('')
    const result = reportSchema.safeParse(form)
    const nextErrors: Record<string, string> = {}

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string') nextErrors[field] = issue.message
      }
    }

    setErrors(nextErrors)
    const fileError = validateReportAttachments(files)
    setAttachmentError(fileError)
    if (!result.success || fileError) return

    try {
      const created = await createReport.mutateAsync({ report: result.data, files })
      setValidationMessage(
        created.officialGuidance
          ? `Denúncia enviada com segurança. ${created.officialGuidance}`
          : 'Denúncia enviada com segurança. Você pode acompanhar o status na sua conta.',
      )
      setFiles([])
      setForm((current) => ({ ...current, category: '', description: '' }))
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.toFieldErrors()
        if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
        setSubmissionError(error.message)
      } else {
        setSubmissionError('Não foi possível enviar a denúncia. Tente novamente.')
      }
    }
  }

  const needsOfficialChannels = form.category === 'MAUS_TRATOS' || form.category === 'ABANDONO'

  return (
    <PageSurface>
      <Container as="section" className="py-10 md:py-16">
        <Card className="mx-auto max-w-[760px] p-6 md:p-10">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-coral">
            Segurança e respeito
          </p>
          <h1 className="mb-2 text-[34px] md:text-[42px]">Fazer uma denúncia</h1>
          <p className="mb-6 text-sm leading-6 text-muted">
            Conte o que aconteceu. Sua identidade é sigilosa e não será exibida à pessoa ou
            organização denunciada.
          </p>

          <InfoNote large className="mb-6">
            O denunciante fica registrado para auditoria, mas sua identidade não é exibida à pessoa
            ou organização denunciada.
          </InfoNote>

          {needsOfficialChannels && (
            <Alert className="mb-6" role="note">
              Em situações de maus-tratos ou abandono, acione também os canais oficiais, como a
              delegacia, o Disque-Denúncia ou o órgão ambiental local. O AdotaPet não substitui uma
              denúncia formal.
            </Alert>
          )}

          <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="O que você está denunciando?" error={errors.targetType} tight>
                <Select
                  value={form.targetType}
                  invalid={Boolean(errors.targetType)}
                  onChange={(event) => updateForm('targetType', event.target.value)}
                >
                  {reportTargetTypes.map((type) => (
                    <option key={type} value={type}>
                      {targetLabels[type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Identificação do item" error={errors.targetId} tight>
                <Input
                  value={form.targetId}
                  invalid={Boolean(errors.targetId)}
                  placeholder="Ex.: nome ou código do item"
                  onChange={(event) => updateForm('targetId', event.target.value)}
                />
              </Field>
            </div>

            <Field label="Categoria" error={errors.category} tight>
              <Select
                value={form.category}
                invalid={Boolean(errors.category)}
                onChange={(event) => updateForm('category', event.target.value)}
              >
                <option value="">Selecione uma categoria</option>
                {reportCategories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Descrição"
              error={errors.description}
              hint={`${form.description.length}/5.000`}
              tight
            >
              <Textarea
                rows={6}
                maxLength={5000}
                value={form.description}
                invalid={Boolean(errors.description)}
                placeholder="Descreva os fatos com o máximo de detalhes possível."
                onChange={(event) => updateForm('description', event.target.value)}
              />
            </Field>

            <Field
              label="Imagens (opcional)"
              error={attachmentError}
              hint="Até 5 imagens JPEG, PNG ou WebP; máximo de 5 MB cada"
              tight
            >
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFiles}
                aria-invalid={Boolean(attachmentError)}
              />
            </Field>
            {files.length > 0 && (
              <ul className="grid gap-2 text-sm text-muted" aria-label="Imagens anexadas">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-forest-50 px-3 py-2"
                  >
                    <span className="truncate">{file.name}</span>
                    <Button type="button" variant="text" onClick={() => removeFile(file)}>
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {validationMessage && (
              <div className="grid gap-2">
                <Alert role="status" aria-live="polite">
                  {validationMessage}
                </Alert>
                <TextLink to="/minhas-denuncias">Acompanhar minhas denúncias →</TextLink>
              </div>
            )}
            {submissionError && <Alert role="alert">{submissionError}</Alert>}
            <div>
              <Button type="submit" loading={createReport.isPending}>
                Enviar denúncia
              </Button>
            </div>
          </form>

          {needsOfficialChannels && (
            <Alert className="mt-6" role="note">
              Reforçando: em caso de maus-tratos ou abandono, procure também os canais oficiais de
              proteção.
            </Alert>
          )}
        </Card>
      </Container>
    </PageSurface>
  )
}
