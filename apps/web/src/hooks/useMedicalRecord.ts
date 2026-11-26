import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  medicalRecordResponseSchema,
  storageUploadResponseSchema,
  type ExamInput,
  type HealthConditionInput,
  type MedicalRecordResponse,
  type NeuteringInput,
  type VaccinationInput,
} from '@adotapet/shared'
import { ApiError } from '../lib/ApiError'
import { api } from '../lib/api'
import { useOrganizationPets } from './useOrganization'
import { petKeys } from './usePets'

export const medicalRecordKeys = {
  all: ['medicalRecord'] as const,
  detail: (petId: string) => [...medicalRecordKeys.all, petId] as const,
}

export type MedicalItemKind = 'vaccinations' | 'conditions' | 'exams'

interface SaveItemArgs<TData> {
  petId: string
  data: TData
  itemId?: string
}

interface DeleteItemArgs {
  petId: string
  kind: MedicalItemKind
  itemId: string
}

interface UploadAttachmentArgs {
  petId: string
  examId: string
  file: File
}

/** 403 na leitura significa "sem vínculo": esconde ações de edição sem quebrar a página. */
export function isMedicalRecordForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 403
}

export function useMedicalRecord(petId?: string) {
  return useQuery<MedicalRecordResponse>({
    queryKey: medicalRecordKeys.detail(petId ?? ''),
    queryFn: async ({ signal }) =>
      medicalRecordResponseSchema.parse(
        await api.get<unknown>(`/pets/${encodeURIComponent(petId as string)}/medical-record`, {
          signal,
        }),
      ),
    enabled: Boolean(petId),
  })
}

/** Membros da organização do pet são os únicos com permissão para editar. */
export function useMedicalRecordPermission(petId?: string) {
  const petsQuery = useOrganizationPets(Boolean(petId))
  return {
    isOrganizationMember: Boolean(petId && petsQuery.data?.some((pet) => pet.id === petId)),
    isPending: petsQuery.isPending,
  }
}

function useSaveMedicalRecordItem<TData>(kind: MedicalItemKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ petId, data, itemId }: SaveItemArgs<TData>): Promise<{ id: string }> => {
      const base = `/pets/${encodeURIComponent(petId)}/medical-record/${kind}`
      return itemId
        ? api.put<{ id: string }>(`${base}/${encodeURIComponent(itemId)}`, data)
        : api.post<{ id: string }>(base, data)
    },
    onSuccess: (_result, { petId }) => {
      void queryClient.invalidateQueries({ queryKey: medicalRecordKeys.detail(petId) })
      void queryClient.invalidateQueries({ queryKey: petKeys.detail(petId) })
    },
  })
}

export function useMedicalRecordMutations() {
  const queryClient = useQueryClient()
  const saveVaccination = useSaveMedicalRecordItem<VaccinationInput>('vaccinations')
  const saveCondition = useSaveMedicalRecordItem<HealthConditionInput>('conditions')
  const saveExam = useSaveMedicalRecordItem<ExamInput>('exams')

  const invalidate = (petId: string) => {
    void queryClient.invalidateQueries({ queryKey: medicalRecordKeys.detail(petId) })
    void queryClient.invalidateQueries({ queryKey: petKeys.detail(petId) })
  }

  const saveNeutering = useMutation({
    mutationFn: async ({ petId, data }: SaveItemArgs<NeuteringInput>) =>
      api.put(`/pets/${encodeURIComponent(petId)}/medical-record/neutering`, data),
    onSuccess: (_result, { petId }) => invalidate(petId),
  })

  const removeItem = useMutation({
    mutationFn: async ({ petId, kind, itemId }: DeleteItemArgs) =>
      api.delete(
        `/pets/${encodeURIComponent(petId)}/medical-record/${kind}/${encodeURIComponent(itemId)}`,
      ),
    onSuccess: (_result, { petId }) => invalidate(petId),
  })

  const uploadAttachment = useMutation({
    mutationFn: async ({ examId, file }: UploadAttachmentArgs) => {
      const body = new FormData()
      body.append('files', file)
      body.append('scope', 'medicalExam')
      body.append('resourceType', 'MEDICAL_EXAM')
      body.append('resourceId', examId)
      const response = await api.post<unknown>('/storage/objects', body)
      return storageUploadResponseSchema.parse(response).data[0]
    },
    onSuccess: (_result, { petId }) => invalidate(petId),
  })

  return {
    saveVaccination,
    saveCondition,
    saveExam,
    saveNeutering,
    removeItem,
    uploadAttachment,
    isPending:
      saveVaccination.isPending ||
      saveCondition.isPending ||
      saveExam.isPending ||
      saveNeutering.isPending ||
      removeItem.isPending ||
      uploadAttachment.isPending,
  }
}
