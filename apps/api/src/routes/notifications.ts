import { Router } from 'express'
import { currentUser } from '../context.js'
import { prisma } from '../db.js'
import type { Notification, NotificationPreference } from '../generated/prisma/client.js'
import type { FieldError } from '../http.js'
import { sendError } from '../http.js'
import { asRecord } from '../validation.js'

export const notificationsRouter = Router()

const NOTIFICATION_TYPES = [
  'RequestStatusChanged',
  'AppointmentProposed',
  'AppointmentConfirmed',
  'MessageReceived',
  'CheckInDue',
  'CheckInOverdue',
  'CheckInReviewed',
  'NewRequestForOrganization',
  'NewMatchingPet',
] as const

const DEFAULT_EMAIL_NOTIFICATION_TYPES = [
  'RequestStatusChanged',
  'AppointmentConfirmed',
  'CheckInOverdue',
  'NewRequestForOrganization',
]

/** O contrato não expõe o dono da notificação. */
const presentNotification = (notification: Notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  link: notification.link,
  readAt: notification.readAt,
  createdAt: notification.createdAt,
})

const presentPreference = (preference: NotificationPreference) => ({
  type: preference.type,
  inApp: preference.inApp,
  email: preference.email,
})

const myNotifications = (userId: string) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

/** Ordem de exibição: a mesma lista de tipos usada pelo frontend. */
type NotificationType = (typeof NOTIFICATION_TYPES)[number]
const indexOfType = (type: string) => NOTIFICATION_TYPES.indexOf(type as NotificationType)
const byTypeOrder = <T extends { type: string }>(rows: T[]) =>
  [...rows].sort((a, b) => indexOfType(a.type) - indexOfType(b.type))

notificationsRouter.get('/me/notifications', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const unreadParam = req.query.unread
  if (unreadParam !== undefined && !['true', 'false'].includes(String(unreadParam))) {
    return sendError(res, 400, 'Parâmetro unread inválido', [
      { field: 'unread', message: 'Use true ou false.' },
    ])
  }

  const all = await myNotifications(userId)
  const unreadCount = all.filter((notification) => !notification.readAt).length
  const matching = unreadParam === 'true' ? all.filter((notification) => !notification.readAt) : all

  const cursor = req.query.cursor
  const cursorIndex =
    cursor === undefined
      ? -1
      : matching.findIndex((notification) => notification.id === String(cursor))
  if (cursor !== undefined && cursorIndex < 0) {
    return sendError(res, 400, 'Cursor inválido', [
      { field: 'cursor', message: 'O cursor não pertence a esta lista.' },
    ])
  }

  const page = matching.slice(cursorIndex + 1, cursorIndex + 1 + 5)
  const hasMore = cursorIndex + 1 + page.length < matching.length
  res.json({
    data: page.map(presentNotification),
    unreadCount,
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  })
})

notificationsRouter.patch('/me/notifications/read-all', async (req, res) => {
  const { id: userId } = await currentUser(req)
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  res.status(204).end()
})

notificationsRouter.patch('/me/notifications/:id/read', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!notification) return sendError(res, 404, 'Notificação não encontrada')

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date() },
  })
  res.status(204).end()
})

/** Preferências do usuário; a primeira consulta cria os padrões. */
async function myPreferences(userId: string) {
  const saved = await prisma.notificationPreference.findMany({ where: { userId } })
  if (saved.length) return byTypeOrder(saved)

  const defaults = NOTIFICATION_TYPES.map((type) => ({
    userId,
    type,
    inApp: true,
    email: DEFAULT_EMAIL_NOTIFICATION_TYPES.includes(type),
  }))
  await prisma.notificationPreference.createMany({ data: defaults, skipDuplicates: true })
  return byTypeOrder(await prisma.notificationPreference.findMany({ where: { userId } }))
}

notificationsRouter.get('/me/notification-preferences', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const preferences = await myPreferences(userId)
  res.json({ data: preferences.map(presentPreference) })
})

notificationsRouter.put('/me/notification-preferences', async (req, res) => {
  const body = asRecord(req.body)
  const data = body?.data
  if (!Array.isArray(data)) {
    return sendError(res, 400, 'Corpo da requisição inválido', [
      { field: 'data', message: 'Envie a lista completa de preferências.' },
    ])
  }

  const details: FieldError[] = []
  const seen = new Set<string>()
  for (const [index, item] of data.entries()) {
    const preference = asRecord(item)
    if (
      !preference ||
      !NOTIFICATION_TYPES.includes(preference.type as NotificationType) ||
      typeof preference.inApp !== 'boolean' ||
      typeof preference.email !== 'boolean' ||
      seen.has(String(preference.type))
    ) {
      details.push({
        field: `data.${index}`,
        message: 'Informe um tipo válido e os canais inApp/email sem duplicar tipos.',
      })
    } else {
      seen.add(String(preference.type))
    }
  }
  if (seen.size !== NOTIFICATION_TYPES.length) {
    details.push({
      field: 'data',
      message: 'Inclua exatamente uma preferência para cada tipo de notificação.',
    })
  }
  if (details.length) return sendError(res, 400, 'Validação falhou', details)

  const { id: userId } = await currentUser(req)
  const rows = data.map((item) => {
    const preference = asRecord(item)
    return {
      userId,
      type: String(preference?.type),
      inApp: preference?.inApp === true,
      email: preference?.email === true,
    }
  })
  await prisma.$transaction([
    prisma.notificationPreference.deleteMany({ where: { userId } }),
    prisma.notificationPreference.createMany({ data: rows }),
  ])
  res.json({ data })
})
