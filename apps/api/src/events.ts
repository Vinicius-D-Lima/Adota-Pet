import { prisma } from './db.js'
import type { Prisma } from './generated/prisma/client.js'

/** Eventos de domínio publicados no outbox (#50); o consumidor entra com #30/#95. */
export const NEW_REQUEST_FOR_ORGANIZATION = 'NewRequestForOrganization'

export interface NewRequestForOrganizationPayload {
  requestId: string
  petId: string
  adopterId: string
  organization: string
  createdAt: string
}

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
