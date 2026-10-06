import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { completeDemoProfile, getDemoPersonalData } from '../lib/demoAccount'
import type { Profile, ProfileDraft } from '../types'
import { calculateProfileCompletion } from '../utils/profileCompletion'

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
    queryFn: async () => {
      const response = await api.get<AdopterProfileResponse>(PROFILE_PATH)
      const personalData = getDemoPersonalData()
      const defaults = Object.fromEntries(
        Object.entries(personalData ?? {}).filter(([, value]) => typeof value === 'string' && value),
      )
      const merged = { ...response }
      for (const [field, value] of Object.entries(defaults)) {
        const current = merged[field as keyof AdopterProfileResponse]
        if (typeof current !== 'string' || current.trim() === '') {
          Object.assign(merged, { [field]: value })
        }
      }
      const result = toAdopterProfile(merged)
      const completion = calculateProfileCompletion('adopter', result.profile)
      result.isComplete = completion.isComplete
      result.missingFields = completion.missingFields.map(({ key }) => key)
      return result
    },
  })
}

export function useSaveAdopterProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profile: Profile) =>
      toAdopterProfile(await api.put<AdopterProfileResponse>(PROFILE_PATH, profile)),
    onSuccess: (savedProfile) => {
      queryClient.setQueryData(adopterProfileKey, savedProfile)
      if (savedProfile.isComplete) completeDemoProfile('/perfil')
    },
  })
}
