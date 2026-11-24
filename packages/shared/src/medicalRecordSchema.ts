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

export type VaccinationInput = z.infer<typeof vaccinationInputSchema>
export type NeuteringInput = z.infer<typeof neuteringInputSchema>
export type HealthConditionInput = z.infer<typeof healthConditionInputSchema>
export type ExamInput = z.infer<typeof examInputSchema>
