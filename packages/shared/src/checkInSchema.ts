import { z } from 'zod'

/** Estados de `CheckIn` usados pela API (#24) e pela visão do adotante (#37). */
export const checkInStatuses = ['PENDENTE', 'ENVIADO', 'ATRASADO', 'REVISADO'] as const

export const checkInStatusLabels: Record<(typeof checkInStatuses)[number], string> = {
  PENDENTE: 'Pendente',
  ENVIADO: 'Enviado',
  ATRASADO: 'Atrasado',
  REVISADO: 'Revisado',
}

const isoDate = z.string().datetime({ offset: true })

export const checkInSubmitSchema = z
  .object({
    report: z
      .string()
      .trim()
      .min(1, 'Escreva um relato sobre o acompanhamento.')
      .max(5000, 'O relato deve ter no máximo 5.000 caracteres.'),
  })
  .strict()

export const checkInSchema = z.object({
  id: z.string(),
  adoptionId: z.string(),
  dueDate: isoDate,
  status: z.enum(checkInStatuses),
  submittedAt: isoDate.nullable().optional(),
  report: z.string().nullable().optional(),
  photos: z.array(z.string()).default([]),
  reviewerComment: z.string().nullable().optional(),
  reviewedAt: isoDate.nullable().optional(),
  createdAt: isoDate.optional(),
})

export const adoptionPetSummarySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    image: z.string().optional(),
    organization: z.string().optional(),
  })
  .passthrough()

export const adoptionPlanSchema = z
  .object({
    id: z.string().optional(),
    adoptionId: z.string().optional(),
    durationDays: z.number().int().positive(),
    intervalDays: z.number().int().positive(),
    completedAt: isoDate.nullable().optional(),
  })
  .passthrough()

export const adoptionSchema = z.object({
  id: z.string(),
  adoptedAt: isoDate,
  adopterId: z.string().optional(),
  pet: adoptionPetSummarySchema.nullable().optional(),
  adopter: z.object({ name: z.string().optional() }).passthrough().nullable().optional(),
  plan: adoptionPlanSchema.nullable().optional(),
  checkIns: z.array(checkInSchema).default([]),
})

export const adoptionsResponseSchema = z.object({
  data: z.array(adoptionSchema),
  total: z.number().int().nonnegative(),
})

export const signedUrlSchema = z.object({
  url: z.string().min(1),
  expiresAt: z.string().min(1),
})

export const CHECK_IN_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const CHECK_IN_MAX_PHOTOS = 5
export const CHECK_IN_MAX_PHOTO_BYTES = 5 * 1024 * 1024

/** Validação no cliente antes de qualquer requisição, com mensagens específicas (#37). */
export function validateCheckInPhotos(files: File[]): string {
  if (files.length > CHECK_IN_MAX_PHOTOS) return 'Escolha no máximo 5 fotos.'
  if (
    files.some(
      (file) => !CHECK_IN_PHOTO_TYPES.includes(file.type as (typeof CHECK_IN_PHOTO_TYPES)[number]),
    )
  ) {
    return 'Use fotos nos formatos JPEG, PNG ou WebP.'
  }
  if (files.some((file) => file.size > CHECK_IN_MAX_PHOTO_BYTES)) {
    return 'Cada foto deve ter no máximo 5 MB.'
  }
  return ''
}

export type CheckInStatus = (typeof checkInStatuses)[number]
export type CheckIn = z.infer<typeof checkInSchema>
export type Adoption = z.infer<typeof adoptionSchema>
export type AdoptionsResponse = z.infer<typeof adoptionsResponseSchema>
export type SignedUrl = z.infer<typeof signedUrlSchema>
export type CheckInSubmit = z.infer<typeof checkInSubmitSchema>
