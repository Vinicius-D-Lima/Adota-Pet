import { pets } from '../../data/pets'
import { requestPetSchema } from '../../schemas/requestSchema'
import type { AdoptionRequest, RequestPet } from '../../types'

export const requestPet: RequestPet = requestPetSchema.parse(pets[0])

export const makeRequest = (overrides: Partial<AdoptionRequest> = {}): AdoptionRequest => ({
  id: 'SOL-1042',
  petId: requestPet.id,
  status: 'Em análise',
  date: '2026-09-08T12:00:00.000Z',
  message: 'A organização recebeu sua solicitação.',
  pet: requestPet,
  ...overrides,
})
