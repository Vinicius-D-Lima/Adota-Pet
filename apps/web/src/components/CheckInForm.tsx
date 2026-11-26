import { checkInSubmitSchema, validateCheckInPhotos, type CheckIn } from '@adotapet/shared'
import { Camera, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSubmitCheckIn } from '../hooks/useAdoptions'
import { ApiError } from '../lib/ApiError'
import { Alert, Button, Card, Field, Input, Textarea } from './ui'

interface PhotoEntry {
  file: File
  url: string
}

interface CheckInFormProps {
  checkIn: CheckIn
  onSubmitted: (updated: CheckIn) => void
}

function revokePreviews(entries: PhotoEntry[]) {
  if (typeof URL.revokeObjectURL !== 'function') return
  for (const { url } of entries) if (url) URL.revokeObjectURL(url)
}

export function CheckInForm({ checkIn, onSubmitted }: CheckInFormProps) {
  const [report, setReport] = useState('')
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const photosRef = useRef<PhotoEntry[]>([])
  const [reportError, setReportError] = useState('')
  const [filesError, setFilesError] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [progress, setProgress] = useState(0)
  const submit = useSubmitCheckIn()

  // Um único cleanup no desmontaje: trocar fotos não invalida as prévias ainda em uso.
  useEffect(() => () => revokePreviews(photosRef.current), [])

  const updatePhotos = (next: PhotoEntry[]) => {
    photosRef.current = next
    setPhotos(next)
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(event.target.files ?? [])
    const error = validateCheckInPhotos([...photosRef.current.map(({ file }) => file), ...added])
    setFilesError(error)

    if (!error && added.length > 0) {
      updatePhotos([
        ...photosRef.current,
        ...added.map((file) => ({
          file,
          url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
        })),
      ])
    }
    event.target.value = ''
  }

  const removeFile = (file: File) => {
    revokePreviews(photosRef.current.filter((entry) => entry.file === file))
    const next = photosRef.current.filter((entry) => entry.file !== file)
    updatePhotos(next)
    setFilesError(validateCheckInPhotos(next.map((entry) => entry.file)))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmissionError('')
    const parsed = checkInSubmitSchema.safeParse({ report })
    const files = photos.map((entry) => entry.file)
    const parsedFilesError = validateCheckInPhotos(files)

    if (!parsed.success) {
      setReportError(parsed.error.issues[0]?.message ?? 'Escreva um relato.')
    } else {
      setReportError('')
    }
    setFilesError(parsedFilesError)
    if (!parsed.success || parsedFilesError) return

    setProgress(0)
    try {
      const updated = await submit.mutateAsync({
        checkInId: checkIn.id,
        report: parsed.data.report,
        files,
        onProgress: setProgress,
      })
      setReport('')
      revokePreviews(photosRef.current)
      updatePhotos([])
      setProgress(100)
      onSubmitted(updated)
    } catch (error) {
      setSubmissionError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível enviar o check-in. Tente novamente.',
      )
      setProgress(0)
    }
  }

  return (
    <Card as="section" className="p-5 md:p-6">
      <h3 className="mb-1 text-xl">Enviar check-in</h3>
      <p className="mb-5 text-sm leading-6 text-muted">
        Conte como está a adaptação do pet e, se quiser, anexe fotos desta etapa.
      </p>

      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <Field label="Relato" error={reportError} tight>
          <Textarea
            rows={5}
            maxLength={5000}
            value={report}
            invalid={Boolean(reportError)}
            placeholder="Ex.: Ele já se adaptou à casa e faz passeios todos os dias."
            onChange={(event) => {
              setReport(event.target.value)
              setReportError('')
            }}
          />
        </Field>

        <Field
          label="Fotos (até 5)"
          error={filesError}
          hint="JPEG, PNG ou WebP · até 5 MB cada"
          tight
        >
          <Input
            type="file"
            accept="image/*"
            multiple
            invalid={Boolean(filesError)}
            onChange={handleFiles}
          />
        </Field>

        {photos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Fotos selecionadas">
            {photos.map(({ file, url }) => (
              <li
                key={`${file.name}-${file.size}`}
                className="overflow-hidden rounded-xl border border-line bg-cream"
              >
                {url && (
                  <img
                    src={url}
                    alt={`Prévia de ${file.name}`}
                    className="h-24 w-full object-cover"
                  />
                )}
                <div className="flex items-center justify-between gap-2 p-2">
                  <span className="truncate text-[11px] text-muted">{file.name}</span>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-1 text-[#a94b32]"
                    aria-label={`Remover ${file.name}`}
                    onClick={() => removeFile(file)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(submit.isPending || progress > 0) && (
          <div
            role="progressbar"
            aria-label="Progresso do upload"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-forest-100"
          >
            <div
              className="h-full rounded-full bg-coral transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {submissionError && <Alert>{submissionError}</Alert>}

        <div>
          <Button type="submit" loading={submit.isPending}>
            <Send size={16} /> Enviar check-in
          </Button>
        </div>
      </form>

      <p className="mb-0 mt-4 flex items-center gap-2 text-[11px] text-muted">
        <Camera size={14} /> No celular, você pode escolher uma foto da galeria ou tirar uma agora.
      </p>
    </Card>
  )
}
