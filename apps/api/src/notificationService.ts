import { internalLinkSchema, notificationTypes } from '@adotapet/shared'
import { createHash } from 'node:crypto'
import type { Transporter } from 'nodemailer'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import type { Prisma } from './generated/prisma/client.js'
import {
  APPOINTMENT_CONFIRMED,
  APPOINTMENT_PROPOSED,
  CHECK_IN_DUE,
  CHECK_IN_OVERDUE,
  CHECK_IN_REVIEWED,
  MESSAGE_RECEIVED,
  NEW_MATCHING_PET,
  NEW_REQUEST_FOR_ORGANIZATION,
  REQUEST_STATUS_CHANGED,
  type DomainEventPayload,
  type DomainEventType,
} from './events.js'
import { logger } from './logger.js'

/**
 * Consumidor dos eventos de domínio (#30): decide destinatário e canais, grava a
 * notificação in-app e enfileira o e-mail no pg-boss. O e-mail é um job separado:
 * se o transporte falhar, a notificação persistida e a retentativa ficam a cargo
 * da fila (NOT-06).
 */
const DEFAULT_EMAIL_TYPES = [
  'RequestStatusChanged',
  'AppointmentConfirmed',
  'CheckInOverdue',
  'NewRequestForOrganization',
] as const

type NotificationType = (typeof notificationTypes)[number]

const indexOfType = (type: string) => notificationTypes.indexOf(type as NotificationType)

/** Preferências efetivas; a primeira consulta cria os padrões do usuário. */
export async function preferencesFor(userId: string) {
  const saved = await prisma.notificationPreference.findMany({ where: { userId } })
  if (!saved.length) {
    await prisma.notificationPreference.createMany({
      data: notificationTypes.map((type) => ({
        userId,
        type,
        inApp: true,
        email: DEFAULT_EMAIL_TYPES.includes(type as (typeof DEFAULT_EMAIL_TYPES)[number]),
      })),
      skipDuplicates: true,
    })
  }
  const rows = await prisma.notificationPreference.findMany({ where: { userId } })
  return [...rows].sort((a, b) => indexOfType(a.type) - indexOfType(b.type))
}

/** NOT-07: texto puro, sem marcação HTML e sem caracteres de controle. */
export function plainText(value: string, max = 500) {
  const withoutHtml = value.replace(/<[^>]*>/g, ' ')
  const withoutControls = [...withoutHtml]
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : character
    })
    .join('')
  return withoutControls.replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Links vêm do serviço, nunca do payload do evento; ainda assim validamos. */
const safeLink = (link: string) =>
  internalLinkSchema.safeParse(link).success ? link : '/notificacoes'

/** ID determinístico: reprocessar o mesmo evento não duplica a notificação. */
const notificationId = (key: string) =>
  `NOT-${createHash('sha256').update(key).digest('hex').slice(0, 24)}`

interface Draft {
  userId: string
  type: NotificationType
  key: string
  title: string
  body: string
  link: string
}

export const notificationEmailJobSchema = z.strictObject({
  notificationId: z.string().min(1),
  userId: z.string().min(1),
  subject: z.string().min(1),
  text: z.string().min(1),
})

export type NotificationEmailJob = z.infer<typeof notificationEmailJobSchema>

/**
 * Injeção do enfileirador evita dependência circular com `jobs.ts`: o worker é
 * quem conhece o pg-boss e a fila de e-mail. Nos testes, um fake registra os jobs.
 */
export type EnqueueEmail = (
  job: NotificationEmailJob,
  options: { tx: Prisma.TransactionClient; singletonKey: string },
) => Promise<unknown>

interface Delivery {
  notificationId: string
  created: boolean
  emailQueued: boolean
}

async function deliver(draft: Draft, enqueueEmail?: EnqueueEmail): Promise<Delivery> {
  const preferences = await preferencesFor(draft.userId)
  const preference = preferences.find((row) => row.type === draft.type)
  const id = notificationId(draft.key)
  const title = plainText(draft.title, 160)
  const body = plainText(draft.body, 600)
  const link = safeLink(draft.link)
  const canCreate = preference?.inApp !== false
  const canEmail = preference?.email === true

  const created = await prisma.$transaction(async (tx) => {
    const result = await tx.notification.createMany({
      data: canCreate
        ? [{ id, userId: draft.userId, type: draft.type, title, body, link, createdAt: new Date() }]
        : [],
      skipDuplicates: true,
    })
    if (canEmail && enqueueEmail) {
      try {
        // Ledger de idempotência: uma notificação nunca gera dois e-mails.
        const effect = await tx.jobEffect.createMany({
          data: [{ eventId: id, type: 'notification-email' }],
          skipDuplicates: true,
        })
        if (effect.count === 0) return { created: result.count > 0, emailQueued: false }
        // O job entra na mesma transação da notificação. Falha ao enfileirar não
        // pode desfazer a notificação in-app (NOT-06).
        await enqueueEmail(
          {
            notificationId: id,
            userId: draft.userId,
            subject: title,
            text: `${body}\n\nAcesse ${link} para ver os detalhes.\n\nSe não foi você, ignore este e-mail.`,
          },
          { tx, singletonKey: id },
        )
      } catch (error) {
        await tx.jobEffect.deleteMany({ where: { eventId: id } })
        logger.warn({ err: error, notificationId: id }, 'não foi possível enfileirar o e-mail')
        return { created: result.count > 0, emailQueued: false }
      }
      return { created: result.count > 0, emailQueued: true }
    }
    return { created: result.count > 0, emailQueued: false }
  })

  return { notificationId: id, ...created }
}

export async function organizationMemberIds(organization: string, adopterId: string) {
  const rows = await prisma.membership.findMany({
    where: {
      userId: { not: adopterId },
      status: 'ATIVO',
      organization: { name: organization },
    },
    select: { userId: true },
  })
  if (rows.length) return rows.map((row) => row.userId)

  // Contas legadas ganham Membership no primeiro acesso; até lá, preservamos
  // as notificações usando os campos antigos do perfil.
  const legacy = await prisma.user.findMany({
    where: {
      id: { not: adopterId },
      OR: [
        { organizationName: organization },
        { guardianProfile: { displayName: organization } },
        { guardianProfile: { legalName: organization } },
      ],
    },
    select: { id: true },
  })
  return legacy.map((row) => row.id)
}

type Handler<T extends DomainEventType> = (
  payload: DomainEventPayload<T>,
  enqueueEmail?: EnqueueEmail,
) => Promise<Delivery | Delivery[] | void>

const handlers: { [K in DomainEventType]: Handler<K> } = {
  [NEW_REQUEST_FOR_ORGANIZATION]: async (payload, enqueueEmail) => {
    const members = await organizationMemberIds(payload.organization, payload.adopterId)
    return Promise.all(
      members.map((userId) =>
        deliver(
          {
            userId,
            type: NEW_REQUEST_FOR_ORGANIZATION,
            key: `${NEW_REQUEST_FOR_ORGANIZATION}:${payload.requestId}:${userId}`,
            title: 'Nova solicitação de adoção',
            body: `${payload.organization} recebeu uma nova solicitação para ${payload.petId}.`,
            link: `/organizacao/solicitacoes/${payload.requestId}`,
          },
          enqueueEmail,
        ),
      ),
    )
  },

  [REQUEST_STATUS_CHANGED]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.adopterId,
        type: REQUEST_STATUS_CHANGED,
        key: `${REQUEST_STATUS_CHANGED}:${payload.requestId}:${payload.status}`,
        title: `Solicitação ${payload.status}`,
        body: payload.message ?? `A instituição atualizou a solicitação do pet ${payload.petName}.`,
        link: `/solicitacoes/${payload.requestId}/enviada`,
      },
      enqueueEmail,
    ),

  [APPOINTMENT_PROPOSED]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.adopterId,
        type: APPOINTMENT_PROPOSED,
        key: `${APPOINTMENT_PROPOSED}:${payload.requestId}`,
        title: 'Novos horários para entrevista',
        body: `A instituição propôs ${payload.slotCount} horário(s) de ${payload.type} para ${payload.petName}.`,
        link: `/solicitacoes/${payload.requestId}/enviada`,
      },
      enqueueEmail,
    ),

  [APPOINTMENT_CONFIRMED]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.adopterId,
        type: APPOINTMENT_CONFIRMED,
        key: `${APPOINTMENT_CONFIRMED}:${payload.requestId}`,
        title: 'Entrevista realizada',
        body: `A entrevista para adotar ${payload.petName} foi marcada como realizada.`,
        link: `/solicitacoes/${payload.requestId}/enviada`,
      },
      enqueueEmail,
    ),

  [MESSAGE_RECEIVED]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.recipientId,
        type: MESSAGE_RECEIVED,
        key: `${MESSAGE_RECEIVED}:${payload.messageId}:${payload.recipientId}`,
        title: `Nova mensagem de ${payload.senderName}`,
        body: 'Você recebeu uma nova mensagem na conversa da solicitação.',
        link: `/solicitacoes/${payload.requestId}/enviada`,
      },
      enqueueEmail,
    ),

  [CHECK_IN_DUE]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.adopterId,
        type: CHECK_IN_DUE,
        key: `${CHECK_IN_DUE}:${payload.checkInId}`,
        title: 'Check-in próximo',
        body: `Está na hora de enviar novidades sobre ${payload.petName}.`,
        link: '/notificacoes',
      },
      enqueueEmail,
    ),

  [CHECK_IN_OVERDUE]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.adopterId,
        type: CHECK_IN_OVERDUE,
        key: `${CHECK_IN_OVERDUE}:${payload.checkInId}`,
        title: 'Check-in atrasado',
        body: `O check-in de ${payload.petName} está atrasado desde ${payload.dueAt}.`,
        link: '/notificacoes',
      },
      enqueueEmail,
    ),

  [CHECK_IN_REVIEWED]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.adopterId,
        type: CHECK_IN_REVIEWED,
        key: `${CHECK_IN_REVIEWED}:${payload.checkInId}`,
        title: 'Check-in revisado',
        body: `A instituição revisou seu check-in de ${payload.petName}: ${payload.status}.`,
        link: '/notificacoes',
      },
      enqueueEmail,
    ),

  [NEW_MATCHING_PET]: async (payload, enqueueEmail) =>
    deliver(
      {
        userId: payload.userId,
        type: NEW_MATCHING_PET,
        key: `${NEW_MATCHING_PET}:${payload.petId}:${payload.userId}`,
        title: 'Um pet compatível chegou',
        body: `${payload.petName} corresponde a uma das suas buscas salvas.`,
        link: `/pets/${payload.petId}`,
      },
      enqueueEmail,
    ),
}

/** Handler registrado nos workers tipados; o tipo do evento já foi validado pelo Zod. */
export function notificationHandlerFor(type: DomainEventType, enqueueEmail?: EnqueueEmail) {
  const handler = handlers[type] as unknown as (
    payload: DomainEventPayload,
    enqueue?: EnqueueEmail,
  ) => Promise<Delivery | Delivery[] | void>
  return (payload: DomainEventPayload) => handler(payload, enqueueEmail)
}

/** Transporte substituível nos testes; em produção vem da configuração. */
let transportOverride: Pick<Transporter, 'sendMail'> | null = null

export function setEmailTransport(transport: Pick<Transporter, 'sendMail'> | null) {
  transportOverride = transport
}

export function createEmailTransport(config = loadConfig()) {
  if (!config.SMTP_HOST) return nodemailer.createTransport({ jsonTransport: true })
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
  })
}

/** Envio isolado: falha aqui não apaga a notificação in-app (NOT-06). */
export async function sendNotificationEmail(payload: NotificationEmailJob) {
  const config = loadConfig()
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  })
  if (!user?.email) return { sent: false, reason: 'sem e-mail cadastrado' }
  const transport = transportOverride ?? createEmailTransport(config)
  await transport.sendMail({
    from: config.SMTP_FROM,
    to: user.email,
    subject: payload.subject,
    text: payload.text,
  })
  return { sent: true }
}
