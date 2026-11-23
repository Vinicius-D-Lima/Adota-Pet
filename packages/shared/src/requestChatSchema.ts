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

/** Query de `/requests/:id/messages`: só `cursor`, como string, é aceita. */
export const requestChatCursorQuerySchema = z.strictObject({
  cursor: z.string().min(1).optional(),
})

/**
 * Corpo de `POST /requests/:id/messages`. O texto é gravado como veio — HTML e
 * `<script>` são literals, nunca interpretados (o frontend renderiza como texto).
 * Não usamos `.trim()` no valor para não alterar a mensagem do usuário; o refine
 * apenas barra mensagens que são só espaços.
 */
export const requestChatMessageBodySchema = z.strictObject({
  body: z
    .string()
    .max(2000, 'A mensagem deve ter no máximo 2000 caracteres')
    .refine((value) => value.trim().length > 0, 'A mensagem não pode ser vazia'),
})

export type RequestChatMessage = z.infer<typeof requestChatMessageSchema>
export type RequestChatPage = z.infer<typeof requestChatPageSchema>
export type RequestChatCursorQuery = z.infer<typeof requestChatCursorQuerySchema>
export type RequestChatMessageBody = z.infer<typeof requestChatMessageBodySchema>
