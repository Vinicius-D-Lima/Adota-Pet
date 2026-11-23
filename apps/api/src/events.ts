import { z } from 'zod'
import { prisma } from './db.js'
import type { Prisma } from './generated/prisma/client.js'

/** Eventos de domínio publicados no outbox (#50); o consumidor entra com #30/#95. */
export const NEW_REQUEST_FOR_ORGANIZATION = 'NewRequestForOrganization'

/**
 * Payload do evento de nova solicitação. `strictObject` garante que o consumidor
 * rejeite campos extras — em especial senha, token e documento (JOB-06).
 */
export const newRequestEventSchema = z.strictObject({
  requestId: z.string().min(1),
  petId: z.string().min(1),
  adopterId: z.string().min(1),
  organization: z.string().min(1),
  createdAt: z.string().min(1),
})

export type NewRequestForOrganizationPayload = z.infer<typeof newRequestEventSchema>

/** Schemas conhecidos pelo despachante do outbox, indexados pelo tipo do evento. */
export const domainEventSchemas = {
  [NEW_REQUEST_FOR_ORGANIZATION]: newRequestEventSchema,
} as const

export type DomainEventType = keyof typeof domainEventSchemas

/**
 * Grava o evento na mesma transação da solicitação (REQ-10 / JOB-07): se a
 * transação desfizer, o evento não fica órfão. O payload não traz dados sensíveis
 * do adotante — só os identificadores necessários ao consumidor.
 */
export function enqueueNewRequestForOrganization(
  tx: Prisma.TransactionClient,
  payload: NewRequestForOrganizationPayload,
) {
  return tx.eventOutbox.create({
    data: {
      type: NEW_REQUEST_FOR_ORGANIZATION,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  })
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
