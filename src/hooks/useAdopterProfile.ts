import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Profile, ProfileDraft } from '../types'

export const adopterProfileKey = ['adopter-profile'] as const

const PROFILE_PATH = '/me/adopter-profile'

const booleanFields = [
  'hasOutdoorArea',
  'hasChildren',
  'hasOtherPets',
  'acceptsSpecialCare',
] as const satisfies ReadonlyArray<keyof ProfileDraft>

const textFields = [
  'name',
  'cpf',
  'birthDate',
  'email',
  'phone',
  'zipCode',
  'address',
  'housing',
  'dailyTime',
  'activityLevel',
  'experience',
  'preferredSpecies',
  'preferredSize',
] as const satisfies ReadonlyArray<keyof ProfileDraft>

type AdopterProfileResponse = Partial<Record<keyof ProfileDraft, unknown>> & {
  userId?: string
  isComplete?: boolean
  missingFields?: string[]
}

export interface AdopterProfile {
  profile: ProfileDraft
  isComplete: boolean
  missingFields: string[]
}

/** Converte a resposta da API para o rascunho do formulário: campos ausentes viram ''. */
export function toAdopterProfile(response: AdopterProfileResponse): AdopterProfile {
  const profile = {} as Record<keyof ProfileDraft, unknown>
  for (const key of textFields) {
    profile[key] = typeof response[key] === 'string' ? response[key] : ''
  }
  for (const key of booleanFields) {
    profile[key] = typeof response[key] === 'boolean' ? response[key] : ''
  }

  return {
    profile: profile as ProfileDraft,
    isComplete: response.isComplete ?? false,
    missingFields: Array.isArray(response.missingFields) ? response.missingFields : [],
  }
}

export function useAdopterProfile() {
  return useQuery({
    queryKey: adopterProfileKey,
    queryFn: async () => toAdopterProfile(await api.get<AdopterProfileResponse>(PROFILE_PATH)),
  })
}

export function useSaveAdopterProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profile: Profile) =>
      toAdopterProfile(await api.put<AdopterProfileResponse>(PROFILE_PATH, profile)),
    onSuccess: (savedProfile) => {
      queryClient.setQueryData(adopterProfileKey, savedProfile)
    },
  })
}
