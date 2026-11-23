import {
  AlertCircle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileWarning,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { reportStatuses, type ReportResponse } from '@adotapet/shared'
import {
  Badge,
  Button,
  Card,
  Container,
  EmptyState,
  LinkButton,
  PageIntro,
  PageSurface,
  cx,
  type BadgeTone,
} from '../components/ui'
import { useMyReports } from '../hooks/useReports'

type ReportStatus = ReportResponse['status']
type StatusFilter = 'TODAS' | ReportStatus

const statusConfig: Record<ReportStatus, { label: string; tone: BadgeTone; icon: LucideIcon }> = {
  ABERTA: { label: 'Aberta', tone: 'sent', icon: AlertCircle },
  EM_ANALISE: { label: 'Em análise', tone: 'review', icon: Clock3 },
  PROCEDENTE: { label: 'Procedente', tone: 'approved', icon: CheckCircle2 },
  IMPROCEDENTE: { label: 'Improcedente', tone: 'declined', icon: FileWarning },
  ARQUIVADA: { label: 'Arquivada', tone: 'declined', icon: Archive },
}

const categoryLabels: Record<ReportResponse['category'], string> = {
  MAUS_TRATOS: 'Maus-tratos',
  ABANDONO: 'Abandono',
  FRAUDE: 'Fraude',
  CONTEUDO_IMPROPRIO: 'Conteúdo impróprio',
  OUTRO: 'Outro',
}

const targetLabels: Record<ReportResponse['targetType'], string> = {
  USUARIO: 'Usuário',
  ORGANIZACAO: 'Organização',
  ADOCAO: 'Adoção',
  PET: 'Pet',
  AVALIACAO: 'Avaliação',
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const { label, tone, icon: Icon } = statusConfig[status]
  return (
    <Badge tone={tone}>
      <Icon size={14} /> {label}
    </Badge>
  )
}

function ReportCard({ report }: { report: ReportResponse }) {
  return (
    <Card as="article" className="grid gap-5 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-coral">
            {categoryLabels[report.category]}
          </p>
          <h2 className="mb-1 text-2xl">
            {targetLabels[report.targetType]} · {report.targetId}
          </h2>
          <p className="mb-0 flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays size={15} /> Enviada em {formatDate(report.createdAt)}
          </p>
        </div>
        <ReportStatusBadge status={report.status} />
      </div>

      <p className="mb-0 whitespace-pre-wrap text-sm leading-6 text-muted">{report.description}</p>

      {report.resolution && (
        <div className="rounded-xl bg-forest-50 p-4">
          <p className="mb-1 text-xs font-bold text-forest-800">Resposta da moderação</p>
          <p className="mb-0 whitespace-pre-wrap text-sm leading-6 text-muted">
            {report.resolution}
          </p>
          {report.resolvedAt && (
            <time className="mt-2 block text-[11px] text-muted" dateTime={report.resolvedAt}>
              Resolvida em {formatDate(report.resolvedAt)}
            </time>
          )}
        </div>
      )}

      {report.attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Paperclip size={16} className="text-muted" />
          {report.attachments.map((attachment, index) => (
            <a
              key={attachment.id}
              className="text-xs font-bold text-forest-700 underline-offset-4 hover:underline"
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
            >
              Ver anexo {index + 1}
            </a>
          ))}
        </div>
      )}
    </Card>
  )
}

export function MyReportsPage() {
  const reportsQuery = useMyReports()
  const [filter, setFilter] = useState<StatusFilter>('TODAS')
  const reports = useMemo(() => reportsQuery.data?.data ?? [], [reportsQuery.data])
  const visibleReports =
    filter === 'TODAS' ? reports : reports.filter((report) => report.status === filter)

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'TODAS', label: 'Todas' },
    ...reportStatuses.map((status) => ({ value: status, label: statusConfig[status].label })),
  ]

  return (
    <PageSurface>
      <Container as="section" className="pb-16 pt-10 md:pb-24 md:pt-14">
        <PageIntro
          eyebrow="Segurança e respeito"
          title="Minhas denúncias"
          description="Acompanhe a análise das denúncias que você enviou. Sua identidade permanece em sigilo durante todo o processo."
          action={<LinkButton to="/denuncias/nova">Fazer nova denúncia</LinkButton>}
        />

        {reportsQuery.isPending ? (
          <div className="grid gap-4" role="status" aria-label="Carregando denúncias">
            {[0, 1, 2].map((item) => (
              <div
                className="h-44 animate-pulse rounded-[20px] border border-line bg-white"
                key={item}
              />
            ))}
          </div>
        ) : reportsQuery.isError ? (
          <EmptyState
            icon={<ShieldAlert size={36} />}
            title="Não foi possível carregar suas denúncias"
            description="Verifique sua conexão e tente novamente."
            role="alert"
          >
            <Button onClick={() => void reportsQuery.refetch()}>
              <RefreshCw size={16} /> Tentar novamente
            </Button>
          </EmptyState>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert size={36} />}
            title="Você ainda não fez nenhuma denúncia"
            description="Quando uma denúncia for enviada, o andamento aparecerá nesta página."
          >
            <LinkButton to="/denuncias/nova">Fazer uma denúncia</LinkButton>
          </EmptyState>
        ) : (
          <>
            <div
              className="mb-6 flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar denúncias por status"
            >
              {filters.map(({ value, label }) => {
                const selected = filter === value
                const count =
                  value === 'TODAS'
                    ? reports.length
                    : reports.filter((report) => report.status === value).length
                return (
                  <button
                    key={value}
                    type="button"
                    className={cx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition',
                      selected
                        ? 'border-forest-800 bg-forest-800 text-white'
                        : 'border-line bg-white text-forest-700 hover:border-forest-300',
                    )}
                    aria-pressed={selected}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                    <span
                      className={cx(
                        'grid min-w-5 place-items-center rounded-full px-1 py-0.5 text-[10px]',
                        selected ? 'bg-white/20 text-white' : 'bg-forest-100 text-forest-700',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {visibleReports.length > 0 ? (
              <div className="grid gap-4" aria-live="polite">
                {visibleReports.map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ShieldAlert size={32} />}
                title={`Nenhuma denúncia com status “${filter === 'TODAS' ? 'Todas' : statusConfig[filter].label}”`}
                description="Escolha outro status para consultar as demais denúncias."
              />
            )}
          </>
        )}
      </Container>
    </PageSurface>
  )
}
