import { z } from 'zod'

const isoDate = z.string().datetime({ offset: true })
const optionalText = z.string().trim().min(1).max(300).nullable().optional()

export const medicalRecordPetParamsSchema = z.object({ petId: z.string().trim().min(1) }).strict()

export const medicalRecordItemParamsSchema = medicalRecordPetParamsSchema
  .extend({ itemId: z.string().trim().min(1) })
  .strict()

export const vaccinationInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    appliedAt: isoDate,
    nextDoseAt: isoDate.nullable().optional(),
    batch: optionalText,
    veterinarian: optionalText,
  })
  .strict()
  .superRefine(({ appliedAt, nextDoseAt }, context) => {
    if (nextDoseAt && Date.parse(nextDoseAt) < Date.parse(appliedAt)) {
      context.addIssue({
        code: 'custom',
        path: ['nextDoseAt'],
        message: 'A próxima dose não pode ser anterior à data de aplicação.',
      })
    }
  })

export const neuteringInputSchema = z
  .object({ done: z.boolean(), date: isoDate.nullable().optional() })
  .strict()
  .superRefine(({ done, date }, context) => {
    if (done && !date) {
      context.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'Informe a data da castração.',
      })
    }
    if (!done && date) {
      context.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'A data só pode ser informada quando a castração foi realizada.',
      })
    }
  })

export const healthConditionTypes = ['CRONICA', 'EM_TRATAMENTO', 'TRATADA'] as const
export const healthConditionInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    type: z.enum(healthConditionTypes),
    notes: z.string().trim().max(2_000).optional().default(''),
    careRequired: z.boolean(),
  })
  .strict()

export const examInputSchema = z
  .object({
    type: z.string().trim().min(2).max(160),
    date: isoDate,
    result: z.string().trim().min(1).max(4_000),
  })
  .strict()

export const medicalAuditSchema = z.object({
  createdAt: z.string().datetime(),
  createdById: z.string(),
  updatedAt: z.string().datetime(),
  updatedById: z.string(),
})

/**
 * Contrato de resposta de GET /pets/:petId/medical-record (#42).
 * A visão pública nunca traz exames, observações nem campos de auditoria;
 * a visão completa (membro da organização ou adotante com solicitação ativa)
 * acrescenta `complete: true` e esses dados.
 */
const medicalRecordBaseSchema = z.object({
  petId: z.string(),
  vaccinated: z.boolean(),
  neutered: z.boolean(),
  specialCare: z.boolean(),
  neutering: z.object({
    done: z.boolean(),
    date: isoDate.nullable().optional(),
  }),
  vaccinations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      appliedAt: isoDate,
      nextDoseAt: isoDate.nullable().optional(),
      batch: optionalText,
      veterinarian: optionalText,
    }),
  ),
  healthConditions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(healthConditionTypes),
      careRequired: z.boolean(),
    }),
  ),
})

export const publicMedicalRecordSchema = medicalRecordBaseSchema.extend({
  complete: z.literal(false).optional(),
})

export const completeMedicalRecordSchema = medicalRecordBaseSchema.extend({
  complete: z.literal(true),
  neutering: medicalRecordBaseSchema.shape.neutering.extend(medicalAuditSchema.shape),
  vaccinations: z.array(
    medicalRecordBaseSchema.shape.vaccinations.element.extend(medicalAuditSchema.shape),
  ),
  healthConditions: z.array(
    medicalRecordBaseSchema.shape.healthConditions.element.extend({
      notes: z.string().optional(),
      ...medicalAuditSchema.shape,
    }),
  ),
  exams: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      date: isoDate,
      result: z.string(),
      attachment: z
        .object({
          id: z.string(),
          url: z.string(),
          expiresAt: z.string(),
        })
        .nullable()
        .optional(),
      ...medicalAuditSchema.shape,
    }),
  ),
})

export const medicalRecordResponseSchema = z.union([
  completeMedicalRecordSchema,
  publicMedicalRecordSchema,
])

export const examAttachmentSchema = completeMedicalRecordSchema.shape.exams.element.shape.attachment

export const storageUploadResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      contentType: z.string(),
      sizeBytes: z.number(),
      url: z.string(),
      expiresAt: z.string(),
    }),
  ),
  total: z.number(),
})

export type VaccinationInput = z.infer<typeof vaccinationInputSchema>
export type NeuteringInput = z.infer<typeof neuteringInputSchema>
export type HealthConditionInput = z.infer<typeof healthConditionInputSchema>
export type ExamInput = z.infer<typeof examInputSchema>
export type PublicMedicalRecord = z.infer<typeof publicMedicalRecordSchema>
export type CompleteMedicalRecord = z.infer<typeof completeMedicalRecordSchema>
export type MedicalRecordResponse = z.infer<typeof medicalRecordResponseSchema>
export type ExamAttachment = z.infer<typeof examAttachmentSchema>
