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

/**
 * NOT-07: notificação nunca aponta para fora da aplicação. Só aceitamos paths
 * absolutos internos (`/solicitacoes/SOL-0001`), sem `//`, barra invertida ou
 * caracteres de controle — os mesmos critérios do utilitário do frontend.
 */
const hasControlCharacter = (value: string) =>
  [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })

export const internalLinkSchema = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (value) =>
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !hasControlCharacter(value),
    'O link deve ser um caminho interno do aplicativo.',
  )

export const notificationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(notificationTypes),
  title: z.string().min(1),
  body: z.string(),
  // A leitura aceita qualquer string: a defesa contra links externos acontece
  // na escrita (serviço) e na navegação (sino/páginas). Assim o frontend ainda
  // consegue detectar e desativar um link malicioso que venha da API.
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

/** Query de `/me/notifications`: `unread` trafega como string na URL. */
export const notificationsQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    unread: z.enum(['true', 'false']).optional(),
  })
  .strict()

/** PUT exige a lista completa, sem tipos repetidos (mesma regra da API e do mock). */
export const notificationPreferencesUpdateSchema = z
  .object({
    data: z
      .array(notificationPreferenceSchema)
      .length(notificationTypes.length, 'Inclua a preferência de cada tipo de notificação.')
      .refine(
        (rows) => new Set(rows.map((row) => row.type)).size === rows.length,
        'Não repita tipos de notificação.',
      ),
  })
  .strict()

export type Notification = z.infer<typeof notificationSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>
export type NotificationPreferencesUpdate = z.infer<typeof notificationPreferencesUpdateSchema>
