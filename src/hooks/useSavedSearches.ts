import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  savedSearchesResponseSchema,
  savedSearchSchema,
  type SavedSearchCriteria,
} from '../schemas/savedSearchSchema'

export { type SavedSearch, type SavedSearchCriteria } from '../schemas/savedSearchSchema'

const savedSearchKeys = {
  all: ['saved-searches'] as const,
}

interface CreateSavedSearch {
  name: string
  criteria: SavedSearchCriteria
}

interface UpdateSavedSearch {
  id: string
  changes: {
    name?: string
    active?: boolean
  }
}

export function useSavedSearches() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: savedSearchKeys.all,
    queryFn: async ({ signal }) =>
      savedSearchesResponseSchema.parse(await api.get<unknown>('/me/saved-filters', { signal })),
  })

  const saveMutation = useMutation({
    mutationFn: async ({ name, criteria }: CreateSavedSearch) =>
      savedSearchSchema.parse(
        await api.post<unknown>('/me/saved-filters', { name, criteria, active: false }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedSearchKeys.all }),
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, changes }: UpdateSavedSearch) =>
      savedSearchSchema.parse(
        await api.patch<unknown>(`/me/saved-filters/${encodeURIComponent(id)}`, changes),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedSearchKeys.all }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/me/saved-filters/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedSearchKeys.all }),
  })

  return {
    searches: query.data?.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    saveSearch: saveMutation.mutateAsync,
    updateSearch: (id: string, changes: UpdateSavedSearch['changes']) =>
      updateMutation.mutateAsync({ id, changes }),
    deleteSearch: deleteMutation.mutateAsync,
  }
}
