import { z } from 'zod'

/**
 * Máquina de estados da solicitação de adoção (#20). Os códigos são gravados no
 * banco; os rótulos legados continuam sendo o contrato público consumido pelo
 * frontend, para que a migração não quebre as telas existentes.
 */
export const requestStatusCodes = [
  'ENVIADA',
  'ANALISE_QUESTIONARIO',
  'ENTREVISTA',
  'VISITA_DOMICILIAR',
  'DECISAO_FINAL',
  'APROVADA',
  'RECUSADA',
  'CANCELADA',
] as const

export type RequestStatusCode = (typeof requestStatusCodes)[number]

export const finalRequestStatusCodes = ['APROVADA', 'RECUSADA', 'CANCELADA'] as const

export const isFinalRequestStatusCode = (
  code: string,
): code is (typeof finalRequestStatusCodes)[number] =>
  (finalRequestStatusCodes as readonly string[]).includes(code)

const labels: Record<RequestStatusCode, string> = {
  ENVIADA: 'Enviada',
  ANALISE_QUESTIONARIO: 'Em análise',
  ENTREVISTA: 'Em análise',
  VISITA_DOMICILIAR: 'Em análise',
  DECISAO_FINAL: 'Em análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
}

const legacyCodes: Record<string, RequestStatusCode> = {
  Enviada: 'ENVIADA',
  'Em análise': 'ANALISE_QUESTIONARIO',
  Aprovada: 'APROVADA',
  Recusada: 'RECUSADA',
  Cancelada: 'CANCELADA',
}

/** Aceita código ou rótulo legado (dados semeados antes da migration). */
export function requestStatusCodeOf(status: string): RequestStatusCode | undefined {
  if ((requestStatusCodes as readonly string[]).includes(status)) return status as RequestStatusCode
  return legacyCodes[status]
}

export function displayRequestStatus(status: string): string {
  const code = requestStatusCodeOf(status)
  return code ? labels[code] : status
}

export type RequestTransitionActor = 'ADOPTER' | 'ORGANIZATION'
export type RequestTransitionPermission = 'requests:review' | 'requests:reject' | 'requests:approve'
export type RequestInterviewType = 'Entrevista online' | 'Visita presencial'

export interface RequestTransitionRule {
  from: RequestStatusCode
  to: RequestStatusCode
  actor: RequestTransitionActor
  permission?: RequestTransitionPermission
  reasonRequired?: boolean
  /** Exige agendamento REALIZADO antes de sair da etapa. */
  requiresRealizedInterview?: boolean
  interviewType?: RequestInterviewType
}

/**
 * Tabela explícita do fluxo (sem XState: o fluxo é linear e a tabela é fácil de
 * testar). As duas regras marcadas como legadas preservam os atalhos já usados
 * pela API antiga e pelos testes de agendamento/RBAC.
 */
export const requestTransitionTable: readonly RequestTransitionRule[] = [
  {
    from: 'ENVIADA',
    to: 'ANALISE_QUESTIONARIO',
    actor: 'ORGANIZATION',
    permission: 'requests:review',
  },
  {
    from: 'ENVIADA',
    to: 'RECUSADA',
    actor: 'ORGANIZATION',
    permission: 'requests:reject',
    reasonRequired: true,
  },
  { from: 'ENVIADA', to: 'CANCELADA', actor: 'ADOPTER' },
  {
    from: 'ANALISE_QUESTIONARIO',
    to: 'ENTREVISTA',
    actor: 'ORGANIZATION',
    permission: 'requests:review',
  },
  {
    from: 'ANALISE_QUESTIONARIO',
    to: 'RECUSADA',
    actor: 'ORGANIZATION',
    permission: 'requests:reject',
    reasonRequired: true,
  },
  { from: 'ANALISE_QUESTIONARIO', to: 'CANCELADA', actor: 'ADOPTER' },
  // Legado: a API permitia aprovar direto após a entrevista realizada.
  {
    from: 'ANALISE_QUESTIONARIO',
    to: 'APROVADA',
    actor: 'ORGANIZATION',
    permission: 'requests:approve',
    requiresRealizedInterview: true,
  },
  {
    from: 'ENTREVISTA',
    to: 'VISITA_DOMICILIAR',
    actor: 'ORGANIZATION',
    permission: 'requests:review',
    requiresRealizedInterview: true,
    interviewType: 'Entrevista online',
  },
  {
    from: 'ENTREVISTA',
    to: 'RECUSADA',
    actor: 'ORGANIZATION',
    permission: 'requests:reject',
    reasonRequired: true,
  },
  { from: 'ENTREVISTA', to: 'CANCELADA', actor: 'ADOPTER' },
  {
    from: 'VISITA_DOMICILIAR',
    to: 'DECISAO_FINAL',
    actor: 'ORGANIZATION',
    permission: 'requests:review',
    requiresRealizedInterview: true,
    interviewType: 'Visita presencial',
  },
  {
    from: 'VISITA_DOMICILIAR',
    to: 'RECUSADA',
    actor: 'ORGANIZATION',
    permission: 'requests:reject',
    reasonRequired: true,
  },
  { from: 'VISITA_DOMICILIAR', to: 'CANCELADA', actor: 'ADOPTER' },
  { from: 'DECISAO_FINAL', to: 'APROVADA', actor: 'ORGANIZATION', permission: 'requests:approve' },
  {
    from: 'DECISAO_FINAL',
    to: 'RECUSADA',
    actor: 'ORGANIZATION',
    permission: 'requests:reject',
    reasonRequired: true,
  },
  { from: 'DECISAO_FINAL', to: 'CANCELADA', actor: 'ADOPTER' },
]

export function findRequestTransition(
  from: RequestStatusCode,
  to: RequestStatusCode,
  actor: RequestTransitionActor,
): RequestTransitionRule | undefined {
  return requestTransitionTable.find(
    (rule) => rule.from === from && rule.to === to && rule.actor === actor,
  )
}

/** Corpo de `POST /requests/:id/transitions`. HTML no motivo fica como texto. */
export const requestTransitionSchema = z.strictObject({
  to: z.enum(requestStatusCodes),
  reason: z.string().max(500).optional(),
})

export type RequestTransitionPayload = z.infer<typeof requestTransitionSchema>

export const requestStatusHistorySchema = z.object({
  id: z.string().min(1),
  from: z.enum(requestStatusCodes),
  to: z.enum(requestStatusCodes),
  actorId: z.string().min(1),
  actorRole: z.string().min(1),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const requestStatusHistoryResponseSchema = z.object({
  data: z.array(requestStatusHistorySchema),
  total: z.number(),
})

export type RequestStatusHistory = z.infer<typeof requestStatusHistorySchema>
