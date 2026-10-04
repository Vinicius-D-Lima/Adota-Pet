import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { adoptionRequestSchema, adoptionRequestsResponseSchema } from '../schemas/requestSchema'
import type { QuestionnaireAnswers } from '../types'
import { isActiveRequest } from '../utils/requestStatus'

export const adoptionRequestKeys = {
  all: ['adoption-requests'] as const,
  list: () => [...adoptionRequestKeys.all, 'list'] as const,
  detail: (id: string) => [...adoptionRequestKeys.all, 'detail', id] as const,
}

export const fetchAdoptionRequests = async () =>
  adoptionRequestsResponseSchema.parse(await api.get('/me/requests')).data

export function useAdoptionRequests() {
  return useQuery({
    queryKey: adoptionRequestKeys.list(),
    queryFn: fetchAdoptionRequests,
  })
}

/**
 * Solicitação ainda ativa (nem Cancelada nem Recusada) do pet, se houver.
 * Enquanto a lista carrega ou se ela falhar devolve `undefined`: o servidor continua barrando com 409.
 */
export function useActiveRequestForPet(petId: string | undefined) {
  const { data } = useAdoptionRequests()
  return data?.find((request) => request.petId === petId && isActiveRequest(request.status))
}

export function useAdoptionRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: adoptionRequestKeys.detail(requestId ?? ''),
    queryFn: async () => adoptionRequestSchema.parse(await api.get(`/requests/${requestId}`)),
    enabled: Boolean(requestId),
  })
}

export function useCreateAdoptionRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { petId: string; answers: QuestionnaireAnswers }) =>
      adoptionRequestSchema.parse(await api.post('/requests', input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adoptionRequestKeys.all }),
  })
}

export function useCancelAdoptionRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (requestId: string) =>
      adoptionRequestSchema.parse(
        await api.post(`/requests/${requestId}/transitions`, { to: 'CANCELADA' }),
      ),
    // Também no erro: um 409 indica que o status mudou, então a lista precisa recarregar.
    onSettled: () => queryClient.invalidateQueries({ queryKey: adoptionRequestKeys.all }),
  })
}
