import { z } from 'zod'

export const reportTargetTypes = ['USUARIO', 'ORGANIZACAO', 'ADOCAO', 'PET', 'AVALIACAO'] as const
export const reportCategories = [
  'MAUS_TRATOS',
  'ABANDONO',
  'FRAUDE',
  'CONTEUDO_IMPROPRIO',
  'OUTRO',
] as const

export const reportSchema = z.object({
  targetType: z.enum(reportTargetTypes),
  targetId: z.string().trim().min(1, 'Informe o item relacionado à denúncia.'),
  category: z.enum(reportCategories, { error: 'Selecione uma categoria.' }),
  description: z
    .string()
    .trim()
    .min(1, 'Descreva o que aconteceu.')
    .max(5000, 'A descrição deve ter no máximo 5.000 caracteres.'),
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
