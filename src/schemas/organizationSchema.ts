import { z } from 'zod'
import { requestPetSchema, requestStatuses } from './requestSchema'

const requiredChoice = (message: string) => z.string().min(1, message)

export const organizationPetFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do pet.'),
  species: requiredChoice('Selecione a espécie.'),
  breed: z.string().trim().min(2, 'Informe a raça ou SRD.'),
  age: z.string().regex(/^\d+$/, 'Informe a idade em anos.'),
  size: requiredChoice('Selecione o porte.'),
  sex: requiredChoice('Selecione o sexo.'),
  city: z.string().trim().min(2, 'Informe a cidade e o estado.'),
  image: z.url('Informe uma URL de imagem válida.'),
  summary: z.string().trim().min(10, 'Escreva um resumo com pelo menos 10 caracteres.'),
  description: z.string().trim().min(20, 'Escreva uma descrição com pelo menos 20 caracteres.'),
  traits: z.string().trim().min(2, 'Informe ao menos uma característica.'),
  energy: requiredChoice('Selecione o nível de energia.'),
  space: z.string().trim().min(2, 'Informe o espaço recomendado.'),
  children: requiredChoice('Informe a convivência com crianças.'),
  otherPets: requiredChoice('Informe a convivência com outros pets.'),
  specialCare: requiredChoice('Informe se exige cuidados especiais.'),
  vaccinated: requiredChoice('Informe se está vacinado.'),
  neutered: requiredChoice('Informe se está castrado.'),
})

export const organizationPetPayloadSchema = organizationPetFormSchema.transform((data) => ({
  ...data,
  age: Number(data.age),
  traits: data.traits
    .split(',')
    .map((trait) => trait.trim())
    .filter(Boolean),
  children: data.children === 'true',
  otherPets: data.otherPets === 'true',
  specialCare: data.specialCare === 'true',
  vaccinated: data.vaccinated === 'true',
  neutered: data.neutered === 'true',
}))

export const interviewStatuses = ['AGENDADA', 'REALIZADA'] as const
export const interviewTypes = ['Entrevista online', 'Visita presencial'] as const

/**
 * `datetime-local` entrega uma data/hora local sem fuso; `new Date` a interpreta no
 * fuso do navegador. Comparar com `Date.now()` evita gravar um horário que já passou.
 */
export const isFutureDateTime = (value: string) => {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now()
}

export const interviewSchema = z.object({
  type: z.string().min(1),
  proposedSlots: z.array(z.string().min(1)).min(1).max(3),
  status: z.enum(interviewStatuses),
  completed: z.boolean(),
  scheduledAt: z.string().optional(),
  completedAt: z.string().optional(),
})

/** Até 3 horários futuros; o formulário começa com um e permite adicionar mais dois. */
export const interviewFormSchema = z.object({
  type: z.enum(interviewTypes, 'Selecione o tipo de encontro.'),
  slots: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Informe o horário.')
        .refine(isFutureDateTime, 'Escolha um horário no futuro.'),
    )
    .min(1, 'Proponha ao menos um horário.')
    .max(3, 'Proponha no máximo 3 horários.'),
})

export const rejectionFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Escreva um motivo com pelo menos 10 caracteres.')
    .max(500, 'O motivo deve ter no máximo 500 caracteres.'),
})

export const receivedRequestSchema = z.object({
  id: z.string().min(1),
  petId: z.string().min(1),
  status: z.enum(requestStatuses),
  date: z.string().min(1),
  message: z.string(),
  pet: requestPetSchema.nullable(),
  unreadMessageCount: z.number().int().nonnegative().optional(),
  interview: interviewSchema.nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  answers: z
    .object({
      motivation: z.string(),
      routine: z.string(),
      aloneTime: z.string(),
      adaptation: z.string(),
      costs: z.boolean(),
      commitment: z.boolean(),
    })
    .optional(),
  adopter: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    completion: z.number().min(0).max(100),
    housing: z.string().optional(),
    dailyTime: z.string().optional(),
    activityLevel: z.string().optional(),
    hasOutdoorArea: z.boolean().optional(),
    acceptsSpecialCare: z.boolean().optional(),
    experience: z.string().optional(),
    hasChildren: z.boolean().optional(),
    hasOtherPets: z.boolean().optional(),
    preferredSpecies: z.string().optional(),
    preferredSize: z.string().optional(),
    zipCode: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
  }),
})

export const receivedRequestsResponseSchema = z.object({
  data: z.array(receivedRequestSchema),
  total: z.number().int().nonnegative(),
})

export type OrganizationPetFormData = z.input<typeof organizationPetFormSchema>
export type OrganizationPetPayload = z.output<typeof organizationPetPayloadSchema>
export type ReceivedRequest = z.infer<typeof receivedRequestSchema>
export type Interview = z.infer<typeof interviewSchema>
export type InterviewFormData = z.infer<typeof interviewFormSchema>
export type RejectionFormData = z.infer<typeof rejectionFormSchema>
