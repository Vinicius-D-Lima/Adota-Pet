import { z } from 'zod'

/** Parâmetros e filtros da API validados no mesmo contrato do frontend (#47). */
export const petIdParamsSchema = z.object({
  id: z.string().min(1, 'Informe o id do pet.'),
})

export const petsQuerySchema = z
  .object({
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive('page deve ser um inteiro positivo').optional(),
    limit: z.coerce
      .number()
      .int()
      .positive('limit deve ser um inteiro positivo')
      .max(100, 'limit máximo é 100')
      .optional(),
    sort: z.enum(['recent', 'name', 'distance']).optional(),
    species: z.string().trim().optional(),
    /// O frontend repete `?size=Pequeno&size=Médio`: aceitar array evita 400 sem
    /// transformações que não podem ser convertidas para JSON Schema (#49).
    size: z.union([z.string(), z.array(z.string())]).optional(),
    sex: z.string().trim().optional(),
    city: z.string().trim().optional(),
    /// Coordenadas para `sort=distance` chegam como texto na query; a conversão
    /// acontece no router, depois da validação (#49).
    lat: z.string().optional(),
    lng: z.string().optional(),
    // Parâmetro desconhecido é erro no contrato da API (ver docs/arquitetura.md).
  })
  .strict()

export type PetsQuery = z.infer<typeof petsQuerySchema>
