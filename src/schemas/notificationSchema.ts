import { z } from 'zod'

export const notificationTypes = [
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

export const notificationTypeLabels: Record<(typeof notificationTypes)[number], string> = {
  RequestStatusChanged: 'Atualizações de solicitações',
  AppointmentProposed: 'Horários de entrevista ou visita',
  AppointmentConfirmed: 'Confirmações de entrevista ou visita',
  MessageReceived: 'Mensagens de chat',
  CheckInDue: 'Check-ins próximos',
  CheckInOverdue: 'Check-ins atrasados',
  CheckInReviewed: 'Revisões de check-ins',
  NewRequestForOrganization: 'Novas solicitações para a organização',
  NewMatchingPet: 'Pets compatíveis com minhas buscas',
}

export const notificationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(notificationTypes),
  title: z.string().min(1),
  body: z.string(),
  link: z.string().min(1),
  readAt: z.string().nullable(),
  createdAt: z.string().min(1),
})

export const notificationPageSchema = z.object({
  data: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable().optional(),
})

export const notificationPreferenceSchema = z.object({
  type: z.enum(notificationTypes),
  inApp: z.boolean(),
  email: z.boolean(),
})

export const notificationPreferencesResponseSchema = z.object({
  data: z.array(notificationPreferenceSchema),
})

export type Notification = z.infer<typeof notificationSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>
