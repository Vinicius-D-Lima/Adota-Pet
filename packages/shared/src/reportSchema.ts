import { z } from 'zod'

export const reportTargetTypes = ['USUARIO', 'ORGANIZACAO', 'ADOCAO', 'PET', 'AVALIACAO'] as const
export const reportCategories = [
  'MAUS_TRATOS',
  'ABANDONO',
  'FRAUDE',
  'CONTEUDO_IMPROPRIO',
  'OUTRO',
] as const
export const reportStatuses = [
  'ABERTA',
  'EM_ANALISE',
  'PROCEDENTE',
  'IMPROCEDENTE',
  'ARQUIVADA',
] as const
export const reportResolutionStatuses = ['PROCEDENTE', 'IMPROCEDENTE', 'ARQUIVADA'] as const

export const reportSchema = z
  .object({
    targetType: z.enum(reportTargetTypes),
    targetId: z.string().trim().min(1, 'Informe o item relacionado à denúncia.'),
    category: z.enum(reportCategories, { error: 'Selecione uma categoria.' }),
    description: z
      .string()
      .trim()
      .min(1, 'Descreva o que aconteceu.')
      .max(5000, 'A descrição deve ter no máximo 5.000 caracteres.'),
  })
  .strict()

export const reportIdParamsSchema = z.object({
  id: z.string().trim().min(1, 'Informe o id da denúncia.'),
})

export const moderationReportsQuerySchema = z
  .object({
    status: z.enum(reportStatuses).optional(),
    category: z.enum(reportCategories).optional(),
  })
  .strict()

export const resolveReportSchema = z
  .object({
    status: z.enum(reportResolutionStatuses),
    resolution: z
      .string()
      .trim()
      .min(1, 'Informe a resolução da denúncia.')
      .max(5000, 'A resolução deve ter no máximo 5.000 caracteres.'),
  })
  .strict()

export const reportAttachmentSchema = z.object({
  id: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  url: z.string(),
  expiresAt: z.string(),
})

export const reportResponseSchema = z.object({
  id: z.string(),
  targetType: z.enum(reportTargetTypes),
  targetId: z.string(),
  category: z.enum(reportCategories),
  description: z.string(),
  status: z.enum(reportStatuses),
  resolution: z.string().nullable(),
  moderatorId: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  attachments: z.array(reportAttachmentSchema),
  officialGuidance: z.string().optional(),
})

export const reportsResponseSchema = z.object({
  data: z.array(reportResponseSchema),
  total: z.number().int().nonnegative(),
})

export const validateReportAttachments = (files: File[]) => {
  if (files.length > 5) return 'Você pode anexar no máximo 5 imagens.'
  if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
    return 'Use imagens nos formatos JPEG, PNG ou WebP.'
  }
  if (files.some((file) => file.size > 5 * 1024 * 1024)) {
    return 'Cada imagem deve ter no máximo 5 MB.'
  }
  return ''
}

export type ReportFormData = z.infer<typeof reportSchema>
export type ResolveReportData = z.infer<typeof resolveReportSchema>
export type ReportResponse = z.infer<typeof reportResponseSchema>
export type ReportsResponse = z.infer<typeof reportsResponseSchema>
