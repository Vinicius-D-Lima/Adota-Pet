import {
  notificationPreferencesUpdateSchema,
  notificationsQuerySchema,
  type NotificationPreferencesUpdate,
  type NotificationsQuery,
} from '@adotapet/shared'
import { Router } from 'express'
import { currentUser } from '../context.js'
import { prisma } from '../db.js'
import type { Notification, NotificationPreference } from '../generated/prisma/client.js'
import { sendError } from '../http.js'
import { preferencesFor } from '../notificationService.js'
import { validate } from '../validate.js'

export const notificationsRouter = Router()

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

const PAGE_SIZE = 5

notificationsRouter.get(
  '/me/notifications',
  validate({ query: notificationsQuerySchema }),
  async (req, res) => {
    const { id: userId } = await currentUser(req)
    const { cursor, unread } = req.query as unknown as NotificationsQuery

    const all = await myNotifications(userId)
    const unreadCount = all.filter((notification) => !notification.readAt).length
    const matching = unread === 'true' ? all.filter((notification) => !notification.readAt) : all

    const cursorIndex =
      cursor === undefined ? -1 : matching.findIndex((notification) => notification.id === cursor)
    if (cursor !== undefined && cursorIndex < 0) {
      return sendError(res, 400, 'Cursor inválido', [
        { field: 'cursor', message: 'O cursor não pertence a esta lista.' },
      ])
    }

    const page = matching.slice(cursorIndex + 1, cursorIndex + 1 + PAGE_SIZE)
    const hasMore = cursorIndex + 1 + page.length < matching.length
    res.json({
      data: page.map(presentNotification),
      unreadCount,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    })
  },
)

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
    where: { id: String(req.params.id), userId },
  })
  if (!notification) return sendError(res, 404, 'Notificação não encontrada')

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date() },
  })
  res.status(204).end()
})

notificationsRouter.get('/me/notification-preferences', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const preferences = await preferencesFor(userId)
  res.json({ data: preferences.map(presentPreference) })
})

/** A lista completa é substituída de uma vez, garantindo um registro por tipo. */
notificationsRouter.put(
  '/me/notification-preferences',
  validate({ body: notificationPreferencesUpdateSchema }),
  async (req, res) => {
    const { id: userId } = await currentUser(req)
    const { data } = req.body as unknown as NotificationPreferencesUpdate
    await prisma.$transaction([
      prisma.notificationPreference.deleteMany({ where: { userId } }),
      prisma.notificationPreference.createMany({
        data: data.map((preference) => ({ userId, ...preference })),
      }),
    ])
    res.json({ data })
  },
)
