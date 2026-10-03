import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelAdoptionRequest, createAdoptionRequest, getRequests } from '../services/localApi'
import type { AdoptionRequest, Pet, QuestionnaireAnswers } from '../types'

export const adoptionRequestKeys = {
  all: ['adoption-requests'] as const,
}

export function useAdoptionRequests() {
  return useQuery({
    queryKey: adoptionRequestKeys.all,
    queryFn: getRequests,
  })
}

export function useCreateAdoptionRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pet, answers }: { pet: Pet; answers: QuestionnaireAnswers }) =>
      createAdoptionRequest(pet, answers),
    onSuccess: (createdRequest) => {
      queryClient.setQueryData<AdoptionRequest[]>(adoptionRequestKeys.all, (current = []) => [
        createdRequest,
        ...current,
      ])
    },
  })
}

export function useCancelAdoptionRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelAdoptionRequest,
    onSuccess: (cancelledRequest) => {
      queryClient.setQueryData<AdoptionRequest[]>(adoptionRequestKeys.all, (current = []) =>
        current.map((request) => (request.id === cancelledRequest.id ? cancelledRequest : request)),
      )
    },
  })
}
