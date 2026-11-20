import { z } from 'zod'

const savedSearchCriteriaSchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    species: z.enum(['Cachorro', 'Gato']).optional(),
    size: z
      .array(z.enum(['Pequeno', 'Médio', 'Grande']))
      .min(1)
      .optional(),
    sex: z.enum(['Fêmea', 'Macho']).optional(),
    city: z.string().trim().min(2).optional(),
  })
  .strict()
  .refine((criteria) => Object.keys(criteria).length > 0, {
    message: 'Informe ao menos um critério de busca.',
  })

export const savedSearchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  criteria: savedSearchCriteriaSchema,
  active: z.boolean(),
  createdAt: z.string().datetime(),
})

export const savedSearchesResponseSchema = z.object({
  data: z.array(savedSearchSchema),
  total: z.number().int().nonnegative(),
})

export type SavedSearchCriteria = z.infer<typeof savedSearchCriteriaSchema>
export type SavedSearch = z.infer<typeof savedSearchSchema>
