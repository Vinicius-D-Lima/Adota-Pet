import { z } from 'zod'

/** Tipos de registro dono que podem receber arquivos (#94). */
export const storageResourceTypes = ['PET', 'CHECKIN', 'REPORT', 'MEDICAL_EXAM'] as const

/** Escopos de upload: cada módulo futura escolhe o seu (#24, #26, #29, #49). */
export const storageScopes = [
  'petPhoto',
  'checkInPhoto',
  'reportAttachment',
  'medicalExam',
] as const

export const storageUploadBodySchema = z.object({
  scope: z.enum(storageScopes),
  resourceType: z.enum(storageResourceTypes),
  resourceId: z.string().trim().min(1),
})

export const storageObjectIdParamsSchema = z.object({
  id: z.string().trim().min(1),
})

// Ausência de token é tratada como 403 no handler (STO-02), não como 400 de
// validação: "sem assinatura" e "assinatura inválida" têm o mesmo efeito.
export const storageFileQuerySchema = z.object({
  token: z.string().trim().optional(),
})

export type StorageUploadBody = z.infer<typeof storageUploadBodySchema>
