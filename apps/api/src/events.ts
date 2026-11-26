import { z } from 'zod'
import { prisma } from './db.js'
import type { Prisma } from './generated/prisma/client.js'

/**
 * Eventos de domínio publicados no outbox (#30/#50/#95). O evento entra na mesma
 * transação da gravação que o gerou; o consumidor de notificações lê depois.
 * Todos os payloads são `strictObject`: nenhum campo sensível (senha, token,
 * documento, e-mail) ou link arbitrário viaja no evento.
 */
const stringId = z.string().min(1).max(120)

/** Nova solicitação para a instituição (REQ-10). Contrato mantido por compatibilidade. */
export const NEW_REQUEST_FOR_ORGANIZATION = 'NewRequestForOrganization'

export const newRequestEventSchema = z.strictObject({
  requestId: stringId,
  petId: stringId,
  adopterId: stringId,
  organization: z.string().min(1).max(200),
  createdAt: z.string().min(1),
})

export type NewRequestForOrganizationPayload = z.infer<typeof newRequestEventSchema>

export const REQUEST_STATUS_CHANGED = 'RequestStatusChanged'
export const requestStatusChangedEventSchema = z.strictObject({
  requestId: stringId,
  adopterId: stringId,
  petName: z.string().min(1).max(200),
  /** Rótulo legado exibido na notificação (compatibilidade com #30). */
  status: z.string().min(1).max(60),
  message: z.string().max(500).optional(),
  // #20: os campos abaixo tornam o evento auditável pelo épico de Notificações.
  from: z.string().min(1).max(60).optional(),
  to: z.string().min(1).max(60).optional(),
  actorId: stringId.optional(),
  actorRole: z.string().min(1).max(60).optional(),
  reason: z.string().max(500).optional(),
  occurredAt: z.string().min(1).optional(),
})

export const APPOINTMENT_PROPOSED = 'AppointmentProposed'
export const appointmentProposedEventSchema = z.strictObject({
  requestId: stringId,
  adopterId: stringId,
  petName: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
  slotCount: z.number().int().min(1).max(3),
})

export const APPOINTMENT_CONFIRMED = 'AppointmentConfirmed'
export const appointmentConfirmedEventSchema = z.strictObject({
  requestId: stringId,
  adopterId: stringId,
  petName: z.string().min(1).max(200),
  completedAt: z.string().min(1),
})

/** #21: o adotante pede novos horários; o responsável é notificado. */
export const APPOINTMENT_RESCHEDULE_REQUESTED = 'AppointmentRescheduleRequested'
export const appointmentRescheduleRequestedEventSchema = z.strictObject({
  requestId: stringId,
  adopterId: stringId,
  petName: z.string().min(1).max(200),
  organization: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
})

export const MESSAGE_RECEIVED = 'MessageReceived'
export const messageReceivedEventSchema = z.strictObject({
  requestId: stringId,
  messageId: stringId,
  recipientId: stringId,
  senderName: z.string().min(1).max(200),
})

export const CHECK_IN_DUE = 'CheckInDue'
export const checkInDueEventSchema = z.strictObject({
  checkInId: stringId,
  adopterId: stringId,
  petName: z.string().min(1).max(200),
  dueAt: z.string().min(1),
})

export const CHECK_IN_OVERDUE = 'CheckInOverdue'
export const checkInOverdueEventSchema = z.strictObject({
  checkInId: stringId,
  adopterId: stringId,
  petName: z.string().min(1).max(200),
  dueAt: z.string().min(1),
})

export const CHECK_IN_REVIEWED = 'CheckInReviewed'
export const checkInReviewedEventSchema = z.strictObject({
  checkInId: stringId,
  adopterId: stringId,
  petName: z.string().min(1).max(200),
  status: z.string().min(1).max(60),
})

export const NEW_MATCHING_PET = 'NewMatchingPet'
export const newMatchingPetEventSchema = z.strictObject({
  userId: stringId,
  petId: stringId,
  petName: z.string().min(1).max(200),
  filterId: stringId.optional(),
})

/** Schemas conhecidos pelo despachante do outbox, indexados pelo tipo do evento. */
export const domainEventSchemas = {
  [NEW_REQUEST_FOR_ORGANIZATION]: newRequestEventSchema,
  [REQUEST_STATUS_CHANGED]: requestStatusChangedEventSchema,
  [APPOINTMENT_PROPOSED]: appointmentProposedEventSchema,
  [APPOINTMENT_CONFIRMED]: appointmentConfirmedEventSchema,
  [APPOINTMENT_RESCHEDULE_REQUESTED]: appointmentRescheduleRequestedEventSchema,
  [MESSAGE_RECEIVED]: messageReceivedEventSchema,
  [CHECK_IN_DUE]: checkInDueEventSchema,
  [CHECK_IN_OVERDUE]: checkInOverdueEventSchema,
  [CHECK_IN_REVIEWED]: checkInReviewedEventSchema,
  [NEW_MATCHING_PET]: newMatchingPetEventSchema,
} as const

export type DomainEventType = keyof typeof domainEventSchemas
export type DomainEventPayload<T extends DomainEventType = DomainEventType> = z.infer<
  (typeof domainEventSchemas)[T]
>

/**
 * Grava o evento na mesma transação da mutação (REQ-10 / JOB-07): se a transação
 * desfizer, o evento não fica órfão.
 */
export function enqueueDomainEvent<T extends DomainEventType>(
  tx: Prisma.TransactionClient,
  type: T,
  payload: DomainEventPayload<T>,
) {
  return tx.eventOutbox.create({
    data: {
      type,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  })
}

export function enqueueNewRequestForOrganization(
  tx: Prisma.TransactionClient,
  payload: NewRequestForOrganizationPayload,
) {
  return enqueueDomainEvent(tx, NEW_REQUEST_FOR_ORGANIZATION, payload)
}

/** Eventos pendentes para o worker de notificações (#30). */
export const pendingEvents = (limit = 100) =>
  prisma.eventOutbox.findMany({
    where: { processedAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

/** Marca o evento como publicado; o `updateMany` estrito é o dedupe do despachante. */
export const markEventProcessed = (id: string) =>
  prisma.eventOutbox.updateMany({
    where: { id, processedAt: null },
    data: { processedAt: new Date() },
  })
