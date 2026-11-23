import { z } from 'zod'

/** Parâmetro das rotas de favoritos (#51). */
export const favoritePetIdParamsSchema = z.object({
  petId: z.string().min(1, 'Informe o id do pet.'),
})

/** `page`/`limit` seguem o mesmo contrato de `/pets` (padrão 1/12, máximo 100). */
export const favoritesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive('page deve ser um inteiro positivo').default(1),
    limit: z.coerce
      .number()
      .int()
      .positive('limit deve ser um inteiro positivo')
      .max(100, 'limit máximo é 100')
      .default(12),
  })
  .strict()

/**
 * Visão resumida do pet favoritado: o suficiente para o card, sem coordenadas
 * nem campos longos (descrição, questionário). `status` é obrigatório para
 * sinalizar pets adotados/arquivados que continuam na lista.
 */
export const favoritePetSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  species: z.string().min(1),
  breed: z.string().min(1),
  age: z.number().nonnegative(),
  ageLabel: z.string().min(1),
  size: z.string().min(1),
  sex: z.string().min(1),
  city: z.string().min(1),
  image: z.url(),
  summary: z.string().min(1),
  traits: z.array(z.string().min(1)).min(1),
  vaccinated: z.boolean(),
  neutered: z.boolean(),
  organization: z.string().min(1),
  // Legados do mock não tinham o campo; o contrato normaliza para DISPONIVEL.
  status: z.enum(['DISPONIVEL', 'ADOTADO', 'ARQUIVADO']).default('DISPONIVEL'),
  distanceKm: z.number().nonnegative().nullable(),
  distance: z.string().nullable(),
})

/** `{ data, total }` é o formato de lista do projeto; `total` é global, não da página. */
export const favoritesResponseSchema = z.object({
  data: z.array(favoritePetSummarySchema),
  total: z.number().int().nonnegative(),
})

export const favoriteIdsResponseSchema = z.object({
  data: z.array(z.string()),
  total: z.number().int().nonnegative(),
})

export type FavoritesQuery = z.infer<typeof favoritesQuerySchema>
export type FavoritePetSummary = z.infer<typeof favoritePetSummarySchema>
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>
export type FavoriteIdsResponse = z.infer<typeof favoriteIdsResponseSchema>
