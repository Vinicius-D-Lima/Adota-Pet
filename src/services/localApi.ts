import { initialRequests, pets } from '../data/pets'
import { petsSchema } from '../schemas/petSchema'
import type { AdoptionRequest, Pet, QuestionnaireAnswers } from '../types'

let requestsStore: AdoptionRequest[] = initialRequests.map((request) => ({ ...request }))

export async function getPets(): Promise<Pet[]> {
  return petsSchema.parse(pets)
}

export async function getRequests(): Promise<AdoptionRequest[]> {
  return requestsStore.map((request) => ({ ...request }))
}

export async function createAdoptionRequest(
  pet: Pet,
  answers: QuestionnaireAnswers,
): Promise<AdoptionRequest> {
  const request: AdoptionRequest = {
    id: `SOL-${String(1042 + requestsStore.length).padStart(4, '0')}`,
    petId: pet.id,
    status: 'Enviada',
    date: new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date()),
    message: 'Sua solicitação foi enviada e aguarda o início da análise.',
    answers,
  }

  requestsStore = [request, ...requestsStore]
  return { ...request }
}

export async function cancelAdoptionRequest(
  requestId: string,
): Promise<AdoptionRequest> {
  const currentRequest = requestsStore.find((request) => request.id === requestId)

  if (!currentRequest) {
    throw new Error('Solicitação não encontrada.')
  }

  const cancelledRequest: AdoptionRequest = {
    ...currentRequest,
    status: 'Cancelada',
    message: 'Você cancelou esta solicitação.',
  }

  requestsStore = requestsStore.map((request) =>
    request.id === requestId ? cancelledRequest : request,
  )

  return { ...cancelledRequest }
}
