import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adoptionsResponseSchema,
  checkInSchema,
  signedUrlSchema,
  type Adoption,
  type CheckIn,
} from '@adotapet/shared'
import { api } from '../lib/api'

export const adoptionKeys = {
  all: ['adoptions'] as const,
  mine: ['adoptions', 'mine'] as const,
  photoUrl: (checkInId: string, photoId: string) =>
    ['adoptions', 'checkInPhoto', checkInId, photoId] as const,
}

export function useMyAdoptions(enabled = true) {
  return useQuery<Adoption[]>({
    queryKey: adoptionKeys.mine,
    queryFn: async ({ signal }) =>
      adoptionsResponseSchema.parse(await api.get<unknown>('/me/adoptions', { signal })).data,
    enabled,
  })
}

interface SubmitCheckInInput {
  checkInId: string
  report: string
  files: File[]
  onProgress?: (percent: number) => void
}

export function useSubmitCheckIn() {
  const queryClient = useQueryClient()
  return useMutation<CheckIn, Error, SubmitCheckInInput>({
    mutationFn: async ({ checkInId, report, files, onProgress }) => {
      const form = new FormData()
      form.set('report', report)
      for (const file of files) form.append('files', file)
      return checkInSchema.parse(
        await api.post<unknown>(`/check-ins/${encodeURIComponent(checkInId)}/submit`, form, {
          onUploadProgress: onProgress,
        }),
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adoptionKeys.mine })
    },
  })
}

/** A URL é de curto prazo: cada foto pede a sua ao abrir o detalhe da adoção. */
export function useCheckInPhotoUrl(checkInId: string, photoId: string) {
  return useQuery({
    queryKey: adoptionKeys.photoUrl(checkInId, photoId),
    queryFn: async () =>
      signedUrlSchema.parse(
        await api.post<unknown>(
          `/check-ins/${encodeURIComponent(checkInId)}/photos/${encodeURIComponent(photoId)}/url`,
        ),
      ),
    enabled: Boolean(checkInId && photoId),
    retry: false,
  })
}
