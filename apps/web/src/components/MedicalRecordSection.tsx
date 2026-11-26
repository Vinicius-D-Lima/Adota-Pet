import type { CompleteMedicalRecord, MedicalRecordResponse } from '@adotapet/shared'
import { CalendarClock, Check, ClipboardList, FileText, Pencil, Syringe, X } from 'lucide-react'
import { formatMedicalDate, isOverdue } from '../lib/medicalRecordFormat'
import type { Pet } from '../types'
import { LinkButton, cx } from './ui'

const conditionLabels = {
  CRONICA: 'Crônica',
  EM_TRATAMENTO: 'Em tratamento',
  TRATADA: 'Tratada',
} as const

interface AuditEntry {
  id: string
  label: string
  createdAt: string
  createdById: string
  updatedAt: string
  updatedById: string
}

export function MedicalRecordHistory({ record }: { record: CompleteMedicalRecord }) {
  const entries: AuditEntry[] = [
    ...record.vaccinations.map((item) => ({ ...item, label: `Vacina ${item.name}` })),
    ...record.healthConditions.map((item) => ({ ...item, label: `Condição ${item.name}` })),
    ...record.exams.map((item) => ({ ...item, label: `Exame ${item.type}` })),
    {
      id: 'neutering',
      label: 'Castração',
      createdAt: record.neutering.createdAt,
      createdById: record.neutering.createdById,
      updatedAt: record.neutering.updatedAt,
      updatedById: record.neutering.updatedById,
    },
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <section className="mt-7 border-t border-line pt-6" aria-labelledby="medical-history-heading">
      <h3 id="medical-history-heading" className="mb-3 flex items-center gap-2 text-base">
        <ClipboardList size={17} className="text-forest-700" /> Histórico de alterações
      </h3>
      <ul className="m-0 list-none space-y-2 p-0">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-xl bg-cream px-3 py-2 text-xs text-muted">
            <strong className="text-ink">{entry.label}</strong>
            <span className="block">
              Criado por {entry.createdById} em {formatMedicalDate(entry.createdAt)} · Atualizado
              por {entry.updatedById} em {formatMedicalDate(entry.updatedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface MedicalRecordSectionProps {
  petId: string
  pet: Pick<Pet, 'vaccinated' | 'neutered'>
  record?: MedicalRecordResponse
  isLoading?: boolean
  canEdit?: boolean
}

/**
 * Resumo público do prontuário no detalhe do pet (#42). Selos, vacinas e
 * condições vêm do prontuário; exames, observações e auditoria só aparecem
 * quando o backend devolve a visão completa.
 */
export function MedicalRecordSection({
  petId,
  pet,
  record,
  isLoading = false,
  canEdit = false,
}: MedicalRecordSectionProps) {
  const vaccinated = record?.vaccinated ?? pet.vaccinated
  const neutered = record?.neutered ?? pet.neutered
  const completeRecord = record?.complete === true ? record : undefined
  const hasRecords = Boolean(
    record &&
    (record.vaccinations.length > 0 ||
      record.healthConditions.length > 0 ||
      record.neutering.done ||
      completeRecord?.exams.length),
  )
  const badges = [
    [vaccinated, 'Vacinado', 'Não vacinado'],
    [neutered, 'Castrado', 'Não castrado'],
  ] as const

  return (
    <section className="mt-7 border-t border-line pt-7" aria-labelledby="health-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="health-heading" className="mb-0 text-[27px]">
          Saúde
        </h2>
        {canEdit && (
          <LinkButton to={`/organizacao/pets/${petId}/prontuario`} variant="secondary" size="sm">
            <Pencil size={14} /> Editar prontuário
          </LinkButton>
        )}
      </div>
      <ul className="mb-4 flex list-none flex-wrap gap-1.5 p-0" aria-label="Selos de saúde">
        {badges.map(([done, yes, no]) => (
          <li
            key={yes}
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
              done ? 'bg-forest-100 text-forest-700' : 'bg-[#fff0d3] text-[#98620c]',
            )}
          >
            {done ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
            {done ? yes : no}
          </li>
        ))}
      </ul>

      {isLoading ? (
        <p className="text-sm text-muted">Carregando prontuário...</p>
      ) : !hasRecords ? (
        <p className="text-sm text-muted">Ainda não há registros de saúde</p>
      ) : (
        <div className="space-y-6">
          {record?.neutering.done && (
            <p className="text-sm text-muted">
              Castração realizada em {formatMedicalDate(record.neutering.date)}
            </p>
          )}
          {record && record.vaccinations.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-base">
                <Syringe size={17} className="text-forest-700" /> Vacinas
              </h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {record.vaccinations.map((vaccination) => {
                  const overdue = isOverdue(vaccination.nextDoseAt)
                  return (
                    <li
                      key={vaccination.id}
                      className={cx(
                        'rounded-xl border p-3 text-xs',
                        overdue ? 'border-coral bg-[#fff7f3]' : 'border-line bg-white',
                      )}
                    >
                      <strong className="block text-sm text-ink">{vaccination.name}</strong>
                      <span className="block text-muted">
                        Aplicada em {formatMedicalDate(vaccination.appliedAt)}
                      </span>
                      {vaccination.nextDoseAt ? (
                        <span className={cx('block', overdue && 'font-bold text-coral')}>
                          Próxima dose: {formatMedicalDate(vaccination.nextDoseAt)}
                          {overdue && ' · Vencida'}
                        </span>
                      ) : (
                        <span className="block text-muted">Sem próxima dose</span>
                      )}
                      {(vaccination.batch || vaccination.veterinarian) && (
                        <span className="block text-muted">
                          {[
                            vaccination.batch && `Lote ${vaccination.batch}`,
                            vaccination.veterinarian,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {record && record.healthConditions.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-base">
                <ClipboardList size={17} className="text-forest-700" /> Condições de saúde e
                cuidados
              </h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {record.healthConditions.map((condition) => {
                  const notes = 'notes' in condition ? condition.notes : undefined
                  return (
                    <li
                      key={condition.id}
                      className="rounded-xl border border-line bg-white p-3 text-xs"
                    >
                      <strong className="block text-sm text-ink">{condition.name}</strong>
                      <span className="block text-muted">{conditionLabels[condition.type]}</span>
                      {condition.careRequired && (
                        <span className="block font-bold text-coral">Cuidados necessários</span>
                      )}
                      {notes && <span className="block text-muted">Observações: {notes}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {completeRecord && completeRecord.exams.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-base">
                <FileText size={17} className="text-forest-700" /> Exames
              </h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {completeRecord.exams.map((exam) => (
                  <li key={exam.id} className="rounded-xl border border-line bg-white p-3 text-xs">
                    <strong className="block text-sm text-ink">{exam.type}</strong>
                    <span className="block text-muted">
                      <CalendarClock size={12} className="mr-1 inline" />
                      {formatMedicalDate(exam.date)}
                    </span>
                    <span className="block text-muted">{exam.result}</span>
                    {exam.attachment?.url && (
                      <a
                        className="mt-1 inline-block font-bold text-forest-700 underline"
                        href={exam.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver exame
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {completeRecord && <MedicalRecordHistory record={completeRecord} />}
        </div>
      )}
    </section>
  )
}
