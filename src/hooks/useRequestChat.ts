import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { organizationKeys } from './useOrganization'
import { adoptionRequestKeys } from './useAdoptionRequests'
import { requestChatPageSchema, requestChatMessageSchema } from '../schemas/requestChatSchema'

export const requestChatKeys = {
  all: ['request-chat'] as const,
  messages: (requestId: string) => [...requestChatKeys.all, requestId] as const,
}

export function useRequestChatMessages(requestId: string) {
  return useInfiniteQuery({
    queryKey: requestChatKeys.messages(requestId),
    queryFn: async ({ pageParam, signal }) =>
      requestChatPageSchema.parse(
        await api.get<unknown>(`/requests/${encodeURIComponent(requestId)}/messages`, {
          query: { cursor: pageParam },
          signal,
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })
}

export function useSendRequestChatMessage(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) =>
      requestChatMessageSchema.parse(
        await api.post<unknown>(`/requests/${encodeURIComponent(requestId)}/messages`, { body }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: requestChatKeys.messages(requestId) }),
  })
}

export function useMarkRequestChatRead(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch<void>(`/requests/${encodeURIComponent(requestId)}/messages/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestChatKeys.messages(requestId) })
      queryClient.invalidateQueries({ queryKey: adoptionRequestKeys.all })
      queryClient.invalidateQueries({ queryKey: organizationKeys.requests() })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 404) {
        queryClient.invalidateQueries({ queryKey: adoptionRequestKeys.all })
        queryClient.invalidateQueries({ queryKey: organizationKeys.requests() })
      }
    },
  })
}
