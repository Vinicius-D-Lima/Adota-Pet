import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  notificationPageSchema,
  notificationPreferencesResponseSchema,
  type NotificationPreference,
} from '../schemas/notificationSchema'

export const notificationKeys = {
  all: ['notifications'] as const,
  preview: ['notifications', 'preview'] as const,
  history: (unread: boolean) => ['notifications', 'history', unread] as const,
  preferences: ['notification-preferences'] as const,
}

export function useNotificationPreview(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.preview,
    queryFn: async ({ signal }) =>
      notificationPageSchema.parse(await api.get<unknown>('/me/notifications', { signal })),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  })
}

export function useNotificationHistory(enabled: boolean, unread: boolean) {
  return useInfiniteQuery({
    queryKey: notificationKeys.history(unread),
    queryFn: async ({ pageParam, signal }) =>
      notificationPageSchema.parse(
        await api.get<unknown>('/me/notifications', {
          query: { cursor: pageParam, unread: unread || undefined },
          signal,
        }),
      ),
    enabled,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useNotificationPreferences(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: async ({ signal }) =>
      notificationPreferencesResponseSchema.parse(
        await api.get<unknown>('/me/notification-preferences', { signal }),
      ).data,
    enabled,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch<void>(`/me/notifications/${encodeURIComponent(id)}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch<void>('/me/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useSaveNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preferences: NotificationPreference[]) =>
      api.put<void>('/me/notification-preferences', { data: preferences }),
    onSuccess: (_data, preferences) => {
      queryClient.setQueryData(notificationKeys.preferences, preferences)
      return queryClient.invalidateQueries({ queryKey: notificationKeys.preferences })
    },
  })
}
