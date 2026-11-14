import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { completeDemoProfile, getDemoPersonalData } from '../lib/demoAccount'
import type { GuardianProfile, GuardianProfileDraft } from '../schemas/guardianProfileSchema'
import { calculateProfileCompletion } from '../utils/profileCompletion'

const PROFILE_PATH = '/me/guardian-profile'
export const guardianProfileKey = ['guardian-profile'] as const

const textFields = [
  'displayName',
  'legalName',
  'document',
  'email',
  'phone',
  'zipCode',
  'address',
  'city',
  'description',
] as const satisfies ReadonlyArray<keyof GuardianProfileDraft>

type GuardianProfileResponse = Partial<Record<keyof GuardianProfileDraft, unknown>> & {
  userId?: string
  isComplete?: boolean
  missingFields?: string[]
}

export interface SavedGuardianProfile {
  profile: GuardianProfileDraft
  isComplete: boolean
  missingFields: string[]
}

export function toGuardianProfile(response: GuardianProfileResponse): SavedGuardianProfile {
  const guardianType =
    response.guardianType === 'INDIVIDUAL' || response.guardianType === 'ORGANIZATION'
      ? response.guardianType
      : ''
  const profile = {
    guardianType,
    acceptsTerms: response.acceptsTerms === true,
  } as GuardianProfileDraft
  for (const field of textFields) {
    profile[field] = (typeof response[field] === 'string' ? response[field] : '') as never
  }
  return {
    profile,
    isComplete: response.isComplete ?? false,
    missingFields: Array.isArray(response.missingFields) ? response.missingFields : [],
  }
}

export function useGuardianProfile() {
  return useQuery({
    queryKey: guardianProfileKey,
    queryFn: async () => {
      const response = await api.get<GuardianProfileResponse>(PROFILE_PATH)
      const personalData = getDemoPersonalData()
      const personalDefaults = personalData
        ? {
            displayName: personalData.organizationName,
            legalName: personalData.responsibleName ?? personalData.name,
            document: personalData.document,
            email: personalData.email,
            phone: personalData.phone,
            zipCode: personalData.zipCode,
            address: personalData.address,
            city:
              personalData.city && personalData.state
                ? `${personalData.city}, ${personalData.state}`
                : personalData.city,
            guardianType: personalData.organizationName ? 'ORGANIZATION' : undefined,
          }
        : {}
      const defaults = Object.fromEntries(
        Object.entries(personalDefaults).filter(([, value]) => typeof value === 'string' && value),
      )
      const merged = { ...response }
      for (const [field, value] of Object.entries(defaults)) {
        const current = merged[field as keyof GuardianProfileResponse]
        if (typeof current !== 'string' || current.trim() === '') {
          Object.assign(merged, { [field]: value })
        }
      }
      const result = toGuardianProfile(merged)
      const completion = calculateProfileCompletion('guardian', result.profile)
      result.isComplete = completion.isComplete
      result.missingFields = completion.missingFields.map(({ key }) => key)
      return result
    },
  })
}

export function useSaveGuardianProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profile: GuardianProfile) =>
      toGuardianProfile(await api.put<GuardianProfileResponse>(PROFILE_PATH, profile)),
    onSuccess: (profile) => {
      queryClient.setQueryData(guardianProfileKey, profile)
      if (profile.isComplete) completeDemoProfile('/perfil?tipo=responsavel')
    },
  })
}
