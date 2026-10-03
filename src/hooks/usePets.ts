import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { petSchema, petsResponseSchema } from '../schemas/petSchema'

export type PetSort = 'recent' | 'name' | 'distance'

export interface PetFilters {
  search?: string
  species?: string
  size?: string
  sex?: string
  sort?: PetSort
  limit?: number
}

export const petKeys = {
  list: (filters: PetFilters) => ['pets', filters] as const,
  detail: (id: string) => ['pet', id] as const,
}

export function usePets(filters: PetFilters = {}) {
  return useInfiniteQuery({
    queryKey: petKeys.list(filters),
    queryFn: async ({ pageParam, signal }) => {
      const response = await api.get<unknown>('/pets', {
        query: {
          search: filters.search || undefined,
          species: filters.species || undefined,
          size: filters.size || undefined,
          sex: filters.sex || undefined,
          sort: filters.sort ?? 'recent',
          limit: filters.limit,
          page: pageParam,
        },
        signal,
      })
      return petsResponseSchema.parse(response)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < lastPage.total ? pages.length + 1 : undefined
    },
    placeholderData: (previousData) => previousData,
  })
}

export function usePet(id?: string) {
  return useQuery({
    queryKey: petKeys.detail(id ?? ''),
    queryFn: async ({ signal }) => {
      const response = await api.get<unknown>(`/pets/${encodeURIComponent(id as string)}`, { signal })
      return petSchema.parse(response)
    },
    enabled: Boolean(id),
  })
}
