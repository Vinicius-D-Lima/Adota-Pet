import type { ReceivedRequest } from '../types'

/**
 * Etapas usadas na lista da organização. "Em entrevista" cobre a análise com
 * agendamento pendente ou já proposto; "Entrevista realizada" libera a aprovação.
 */
export const ORGANIZATION_REQUEST_STAGES = [
  { key: 'all', label: 'Todas', matches: () => true },
  {
    key: 'new',
    label: 'Novas',
    matches: (request: ReceivedRequest) => request.status === 'Enviada',
  },
  {
    key: 'interview',
    label: 'Em entrevista',
    matches: (request: ReceivedRequest) =>
      request.status === 'Em análise' && request.interview?.completed !== true,
  },
  {
    key: 'interview-done',
    label: 'Entrevista realizada',
    matches: (request: ReceivedRequest) =>
      request.status === 'Em análise' && request.interview?.completed === true,
  },
  {
    key: 'approved',
    label: 'Aprovadas',
    matches: (request: ReceivedRequest) => request.status === 'Aprovada',
  },
  {
    key: 'closed',
    label: 'Encerradas',
    matches: (request: ReceivedRequest) =>
      request.status === 'Recusada' || request.status === 'Cancelada',
  },
] as const

export type OrganizationRequestStageKey = (typeof ORGANIZATION_REQUEST_STAGES)[number]['key']

export function isOrganizationRequestStage(
  value: string | null,
): value is OrganizationRequestStageKey {
  return ORGANIZATION_REQUEST_STAGES.some((stage) => stage.key === value)
}

export function countByStage(requests: ReceivedRequest[]) {
  return Object.fromEntries(
    ORGANIZATION_REQUEST_STAGES.map((stage) => [
      stage.key,
      requests.filter((request) => stage.matches(request)).length,
    ]),
  ) as Record<OrganizationRequestStageKey, number>
}
