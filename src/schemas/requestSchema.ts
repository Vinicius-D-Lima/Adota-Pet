import { z } from 'zod'
import { petSchema } from './petSchema'

export const requestStatuses = [
  'Em análise',
  'Aprovada',
  'Enviada',
  'Recusada',
  'Cancelada',
] as const

/** O pet embutido na solicitação não traz `distance` nem `distanceKm` (calculados só em /pets). */
export const requestPetSchema = petSchema.omit({ distance: true, distanceKm: true })

export const adoptionRequestSchema = z.object({
  id: z.string().min(1),
  petId: z.string().min(1),
  status: z.enum(requestStatuses),
  date: z.string().min(1),
  message: z.string(),
  pet: requestPetSchema.nullable(),
})

export const adoptionRequestsResponseSchema = z.object({
  data: z.array(adoptionRequestSchema),
  total: z.number(),
})

export type RequestStatus = (typeof requestStatuses)[number]
export type RequestPet = z.infer<typeof requestPetSchema>
export type AdoptionRequest = z.infer<typeof adoptionRequestSchema>
