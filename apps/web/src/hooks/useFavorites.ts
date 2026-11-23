import {
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  favoriteIdsResponseSchema,
  favoritesResponseSchema,
  type FavoritesResponse,
} from '@adotapet/shared'
import { showFavoriteNotice } from './useFavoriteNotice'

export const favoriteKeys = {
  all: ['favorites'] as const,
  ids: ['favorites', 'ids'] as const,
  pets: ['favorites', 'pets'] as const,
}

const favoriteMutationKey = ['favorites', 'toggle'] as const

interface ToggleVariables {
  petId: string
  /** Estado desejado depois do clique (não "inverter": PUT/DELETE são idempotentes). */
  favorite: boolean
}

const withMembership = (ids: string[], petId: string, favorite: boolean) => {
  const rest = ids.filter((id) => id !== petId)
  return favorite ? [...rest, petId] : rest
}

type FavoritePages = InfiniteData<FavoritesResponse, number>

/** Atualização otimista precisa respeitar o formato de `useInfiniteQuery`. */
const removeFromPages = (pages: FavoritePages | undefined, petId: string) =>
  pages && {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      data: page.data.filter((pet) => pet.id !== petId),
      total: Math.max(0, page.total - 1),
    })),
  }

export function useFavoriteIds(enabled = true) {
  return useQuery({
    enabled,
    queryKey: favoriteKeys.ids,
    queryFn: async ({ signal }) =>
      favoriteIdsResponseSchema.parse(await api.get<unknown>('/me/favorites/ids', { signal })).data,
  })
}

/** Lista paginada: `/me/favorites/ids` continua trazendo todos os ids para os cards. */
export function useFavoritePets() {
  return useInfiniteQuery({
    queryKey: favoriteKeys.pets,
    queryFn: async ({ pageParam, signal }) =>
      favoritesResponseSchema.parse(
        await api.get<unknown>('/me/favorites', { query: { page: pageParam }, signal }),
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < lastPage.total ? pages.length + 1 : undefined
    },
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: favoriteMutationKey,
    // Mesmo scope = execução em fila: as chamadas chegam ao mock na ordem dos cliques.
    scope: { id: 'favorites' },
    mutationFn: ({ petId, favorite }: ToggleVariables) => {
      const path = `/me/favorites/${encodeURIComponent(petId)}`
      return favorite ? api.put<void>(path) : api.delete<void>(path)
    },
    onMutate: async ({ petId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.all })
      const previousPets = queryClient.getQueryData<FavoritePages>(favoriteKeys.pets)

      queryClient.setQueryData<string[]>(favoriteKeys.ids, (ids = []) =>
        withMembership(ids, petId, favorite),
      )
      if (!favorite) {
        queryClient.setQueryData<FavoritePages | undefined>(favoriteKeys.pets, (pages) =>
          removeFromPages(pages, petId),
        )
      }

      return { previousPets }
    },
    onError: (_error, { petId, favorite }, context) => {
      // Desfaz só este pet, sem apagar o que outros cliques já alteraram.
      queryClient.setQueryData<string[]>(favoriteKeys.ids, (ids = []) =>
        withMembership(ids, petId, !favorite),
      )
      if (context?.previousPets) {
        queryClient.setQueryData<FavoritePages>(favoriteKeys.pets, context.previousPets)
      }
      showFavoriteNotice(
        favorite
          ? 'Não foi possível favoritar o pet. Tente novamente.'
          : 'Não foi possível remover o pet dos favoritos. Tente novamente.',
      )
    },
    onSettled: () => {
      // Só a última mutação da fila ressincroniza; antes disso o refetch traria estado velho.
      if (queryClient.isMutating({ mutationKey: favoriteMutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: favoriteKeys.all })
      }
    },
  })
}

export function useFavorite(petId: string) {
  const queryClient = useQueryClient()
  const idsQuery = useFavoriteIds()
  const { mutate } = useToggleFavorite()
  const pendingCount = useIsMutating({
    mutationKey: favoriteMutationKey,
    predicate: (mutation) =>
      (mutation.state.variables as ToggleVariables | undefined)?.petId === petId,
  })
  const isFavorite = idsQuery.data?.includes(petId) ?? false

  const toggle = () => {
    // Lê o cache (não o render): cliques rápidos precisam enxergar a atualização otimista anterior.
    const current = queryClient.getQueryData<string[]>(favoriteKeys.ids)?.includes(petId) ?? false
    mutate({ petId, favorite: !current })
  }

  return { isFavorite, toggle, isPending: pendingCount > 0 }
}
