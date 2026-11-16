import { z } from 'zod'

export const requestChatMessageSchema = z.object({
  id: z.string().min(1),
  authorName: z.string(),
  mine: z.boolean(),
  body: z.string().min(1).max(2000),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
})

export const requestChatPageSchema = z.object({
  data: z.array(requestChatMessageSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
})

export type RequestChatMessage = z.infer<typeof requestChatMessageSchema>
export type RequestChatPage = z.infer<typeof requestChatPageSchema>
