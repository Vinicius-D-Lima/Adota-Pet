import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '../lib/api'
import { petsResponseSchema } from '../schemas/petSchema'
import type { Pet } from '../types'
import { showFavoriteNotice } from './useFavoriteNotice'

export const favoriteKeys = {
  all: ['favorites'] as const,
  ids: ['favorites', 'ids'] as const,
  pets: ['favorites', 'pets'] as const,
}

const favoriteMutationKey = ['favorites', 'toggle'] as const

const favoriteIdsResponseSchema = z.object({
  data: z.array(z.string()),
  total: z.number().int().nonnegative(),
})

interface ToggleVariables {
  petId: string
  /** Estado desejado depois do clique (não "inverter": PUT/DELETE são idempotentes). */
  favorite: boolean
}

const withMembership = (ids: string[], petId: string, favorite: boolean) => {
  const rest = ids.filter((id) => id !== petId)
  return favorite ? [...rest, petId] : rest
}

export function useFavoriteIds() {
  return useQuery({
    queryKey: favoriteKeys.ids,
    queryFn: async ({ signal }) =>
      favoriteIdsResponseSchema.parse(await api.get<unknown>('/me/favorites/ids', { signal })).data,
  })
}

export function useFavoritePets() {
  return useQuery({
    queryKey: favoriteKeys.pets,
    queryFn: async ({ signal }) =>
      petsResponseSchema.parse(await api.get<unknown>('/me/favorites', { signal })).data,
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
      const previousPets = queryClient.getQueryData<Pet[]>(favoriteKeys.pets)

      queryClient.setQueryData<string[]>(favoriteKeys.ids, (ids = []) =>
        withMembership(ids, petId, favorite),
      )
      if (!favorite) {
        queryClient.setQueryData<Pet[]>(favoriteKeys.pets, (pets) =>
          pets?.filter((pet) => pet.id !== petId),
        )
      }

      return { previousPets }
    },
    onError: (_error, { petId, favorite }, context) => {
      // Desfaz só este pet, sem apagar o que outros cliques já alteraram.
      queryClient.setQueryData<string[]>(favoriteKeys.ids, (ids = []) =>
        withMembership(ids, petId, !favorite),
      )
      if (context?.previousPets) queryClient.setQueryData(favoriteKeys.pets, context.previousPets)
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
