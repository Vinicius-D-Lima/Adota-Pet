import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { petSchema, petsResponseSchema, type Pet } from '../schemas/petSchema'
import {
  receivedRequestSchema,
  receivedRequestsResponseSchema,
  type InterviewFormData,
  type OrganizationPetPayload,
} from '../schemas/organizationSchema'

export const organizationKeys = {
  all: ['organization'] as const,
  pets: () => [...organizationKeys.all, 'pets'] as const,
  requests: () => [...organizationKeys.all, 'requests'] as const,
  request: (id: string) => [...organizationKeys.requests(), id] as const,
}

export type OrganizationRequestTransition = 'EM_ANALISE' | 'APROVADA' | 'RECUSADA'

export function useOrganizationPets(enabled = true) {
  return useQuery({
    queryKey: organizationKeys.pets(),
    queryFn: async () => petsResponseSchema.parse(await api.get('/me/organization-pets')).data,
    enabled,
  })
}

export function useReceivedRequests(enabled = true) {
  return useQuery({
    queryKey: organizationKeys.requests(),
    queryFn: async () =>
      receivedRequestsResponseSchema.parse(await api.get('/me/received-requests')).data,
    enabled,
  })
}

export function useReceivedRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.request(requestId ?? ''),
    queryFn: async () =>
      receivedRequestSchema.parse(
        await api.get(`/me/received-requests/${encodeURIComponent(requestId ?? '')}`),
      ),
    enabled: Boolean(requestId),
  })
}

export function useSaveOrganizationPet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: OrganizationPetPayload }) =>
      petSchema.parse(
        id
          ? await api.put(`/me/organization-pets/${encodeURIComponent(id)}`, data)
          : await api.post('/me/organization-pets', data),
      ),
    onSuccess: (pet: Pet) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.pets() })
      queryClient.invalidateQueries({ queryKey: ['pets'] })
      queryClient.invalidateQueries({ queryKey: ['pet', pet.id] })
    },
  })
}

export function useDeleteOrganizationPet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/me/organization-pets/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.pets() })
      queryClient.invalidateQueries({ queryKey: ['pets'] })
    },
  })
}

export function useUpdateReceivedRequestStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      to,
      reason,
    }: {
      id: string
      to: OrganizationRequestTransition
      reason?: string
    }) =>
      receivedRequestSchema.parse(
        await api.post(`/me/received-requests/${encodeURIComponent(id)}/transitions`, {
          to,
          ...(reason ? { reason } : {}),
        }),
      ),
    // Também no erro: um 409 indica que o estado mudou e a lista precisa recarregar.
    onSettled: () => queryClient.invalidateQueries({ queryKey: organizationKeys.requests() }),
  })
}

export function useScheduleInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { type: InterviewFormData['type']; proposedSlots: string[] }
    }) =>
      receivedRequestSchema.parse(
        await api.post(`/me/received-requests/${encodeURIComponent(id)}/interview`, data),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: organizationKeys.requests() }),
  })
}

export function useCompleteInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      receivedRequestSchema.parse(
        await api.post(`/me/received-requests/${encodeURIComponent(id)}/interview/complete`),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: organizationKeys.requests() }),
  })
}
