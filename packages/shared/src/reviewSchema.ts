import { z } from 'zod'

/** Campos aceitos ao criar ou editar uma avaliação; identidade vem do JWT. */
export const reviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).default(''),
})

export type ReviewBody = z.infer<typeof reviewBodySchema>
