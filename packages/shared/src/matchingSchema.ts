import { z } from 'zod'

/**
 * Resultado do cálculo de compatibilidade (#19). O mesmo formato é produzido
 * pelo serviço do backend e consumido pelo detalhe da solicitação na ONG.
 */
export const matchingLevelSchema = z.enum(['Alta', 'Média', 'Baixa'])

export const matchingCheckSchema = z.object({
  ok: z.boolean(),
  good: z.string(),
  attention: z.string(),
})

export const matchingScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: matchingLevelSchema,
  good: z.array(matchingCheckSchema),
  attention: z.array(matchingCheckSchema),
})

export type MatchingLevel = z.infer<typeof matchingLevelSchema>
export type MatchingCheck = z.infer<typeof matchingCheckSchema>
export type MatchingScore = z.infer<typeof matchingScoreSchema>
