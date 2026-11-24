import {
  displayRequestStatus,
  isFinalRequestStatusCode,
  requestStatusCodeOf,
  requestTransitionTable,
  type RequestInterviewType,
  type RequestStatusCode,
  type RequestTransitionActor,
  type RequestTransitionRule,
} from '@adotapet/shared'
import type { Request } from 'express'
import { currentUser, permissionsForRole } from './context.js'
import { prisma } from './db.js'
import { REQUEST_STATUS_CHANGED, enqueueDomainEvent } from './events.js'
import type { AdoptionRequest, Prisma } from './generated/prisma/client.js'
import { HttpError } from './http.js'
import { asRecord } from './validation.js'

/** Quem pode disparar a transição, resolvido no servidor a partir da identidade. */
interface TransitionActor {
  kind: RequestTransitionActor
  id: string
  role: string
  permissions: string[]
}

export interface ApplyTransitionInput {
  req: Request
  requestId: string
  to: RequestStatusCode
  reason?: string
  /** Efeito na mesma transação (ex.: formalizar adoção ao aprovar, #23). */
  onTransition?: (context: {
    tx: Prisma.TransactionClient
    request: AdoptionRequest
    row: AdoptionRequest
    from: RequestStatusCode
    to: RequestStatusCode
    actor: TransitionActor
  }) => Promise<void>
}

const invalid = (from: string, to: string) =>
  new HttpError(409, `transição inválida de ${from} para ${to}`)

export async function resolveTransitionActor(req: Request, request: AdoptionRequest) {
  const { id } = await currentUser(req)
  if (request.userId === id) {
    return { kind: 'ADOPTER' as const, id, role: 'ADOPTER', permissions: [] }
  }

  const pet = await prisma.pet.findUnique({
    where: { id: request.petId },
    select: { organizationId: true },
  })
  if (!pet) return null
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: id, organizationId: pet.organizationId } },
  })
  if (!membership || membership.status !== 'ATIVO') return null

  const role = membership.role
  return {
    kind: 'ORGANIZATION' as const,
    id,
    role,
    permissions: permissionsForRole(role) as string[],
  }
}

const realizedInterview = (value: unknown, type?: RequestInterviewType) => {
  const interview = asRecord(value)
  return (
    interview?.status === 'REALIZADA' &&
    interview?.completed === true &&
    (type === undefined || interview.type === type)
  )
}

const messages: Record<RequestStatusCode, string> = {
  ENVIADA: 'Sua solicitação foi enviada.',
  ANALISE_QUESTIONARIO: 'A instituição iniciou a análise da sua solicitação.',
  ENTREVISTA: 'A instituição avançou para a etapa de entrevista.',
  VISITA_DOMICILIAR: 'A instituição avançou para a visita domiciliar.',
  DECISAO_FINAL: 'A instituição está decidindo sobre a sua solicitação.',
  APROVADA: 'Sua solicitação foi aprovada pela instituição.',
  RECUSADA: 'A instituição encerrou esta solicitação.',
  CANCELADA: 'Solicitação cancelada por você.',
}

const messageFor = (to: RequestStatusCode, reason?: string) => {
  const base = to === 'RECUSADA' && reason ? `${messages.RECUSADA}: ${reason}` : messages[to]
  // O evento limita `message` a 500 caracteres (também usado no e-mail).
  return base.slice(0, 500)
}

/** Verifica a regra pura; usado pela rota e pelos testes da tabela. */
export function checkTransition(rule: RequestTransitionRule, actor: TransitionActor) {
  if (rule.permission && !actor.permissions.includes(rule.permission)) {
    return new HttpError(403, 'Você não tem permissão para realizar esta transição.')
  }
  return null
}

/**
 * Aplica uma transição com controle otimista de versão: duas requisições
 * simultâneas leem a mesma versão, mas só o `updateMany` condicional vence.
 */
export async function applyTransition({
  req,
  requestId,
  to,
  reason,
  onTransition,
}: ApplyTransitionInput) {
  const request = await prisma.adoptionRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new HttpError(404, 'Solicitação não encontrada')

  const actor = await resolveTransitionActor(req, request)
  if (!actor) throw new HttpError(403, 'Você não tem permissão para alterar esta solicitação')

  const from = requestStatusCodeOf(request.status)
  if (!from || isFinalRequestStatusCode(from)) throw invalid(from ?? request.status, to)

  const candidates = requestTransitionTable.filter(
    (candidate) => candidate.from === from && candidate.to === to,
  )
  if (!candidates.length) throw invalid(from, to)
  const rule = candidates.find((candidate) => candidate.actor === actor.kind)
  // A transição existe, mas é de outro papel (adotante tentando aprovar,
  // instituição tentando cancelar): é autorização, não transição inválida.
  if (!rule) throw new HttpError(403, 'Você não tem permissão para realizar esta transição.')

  const denied = checkTransition(rule, actor)
  if (denied) throw denied

  const trimmedReason = reason?.trim()
  if (rule.reasonRequired && !trimmedReason) {
    throw new HttpError(400, 'Informe o motivo da recusa', [
      { field: 'reason', message: 'O motivo é obrigatório para recusar' },
    ])
  }
  if (rule.requiresRealizedInterview && !realizedInterview(request.interview, rule.interviewType)) {
    throw new HttpError(409, 'O agendamento desta etapa precisa estar marcado como realizado.', [
      {
        field: 'interview',
        message: 'Marque o agendamento correspondente como realizado antes de avançar.',
      },
    ])
  }

  const message = messageFor(to, trimmedReason)
  const occurredAt = new Date()

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const claimed = await tx.adoptionRequest.updateMany({
      where: { id: request.id, status: request.status, version: request.version },
      data: {
        status: to,
        version: { increment: 1 },
        message,
        ...(to === 'RECUSADA' && trimmedReason ? { rejectionReason: trimmedReason } : {}),
      },
    })
    // Outra transição venceu a corrida (FSM-09).
    if (claimed.count !== 1) throw invalid(from, to)

    const row = await tx.adoptionRequest.findUniqueOrThrow({ where: { id: request.id } })
    const history = await tx.requestStatusHistory.create({
      data: {
        requestId: row.id,
        fromStatus: from,
        toStatus: to,
        actorId: actor.id,
        actorRole: actor.role,
        reason: trimmedReason ?? null,
        createdAt: occurredAt,
      },
    })
    await enqueueDomainEvent(tx, REQUEST_STATUS_CHANGED, {
      requestId: row.id,
      adopterId: row.userId,
      petName:
        (await tx.pet.findUnique({ where: { id: row.petId }, select: { name: true } }))?.name ??
        'pet',
      status: displayRequestStatus(to),
      message,
      from,
      to,
      actorId: actor.id,
      actorRole: actor.role,
      reason: trimmedReason,
      occurredAt: occurredAt.toISOString(),
    })
    // Se falhar, o rollback desfaz status, histórico e evento juntos.
    await onTransition?.({ tx, request, row, from, to, actor })
    return { row, history }
  })
}
