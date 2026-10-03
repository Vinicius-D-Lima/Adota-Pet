import { requestPetSchema } from '../../schemas/requestSchema'
import type { AdoptionRequest, RequestPet } from '../../types'
import { petFixture } from '../petFixture'

export const requestPet: RequestPet = requestPetSchema.parse(petFixture)

export const makeRequest = (overrides: Partial<AdoptionRequest> = {}): AdoptionRequest => ({
  id: 'SOL-1042',
  petId: requestPet.id,
  status: 'Em análise',
  date: '2026-09-08T12:00:00.000Z',
  message: 'A organização recebeu sua solicitação.',
  pet: requestPet,
  ...overrides,
})
