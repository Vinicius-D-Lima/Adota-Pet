import { z } from 'zod'
import { matchingScoreSchema } from './matchingSchema.js'
import { requestPetSchema, requestStatuses } from './requestSchema.js'
import { requestStatusCodeOf } from './requestStateMachine.js'

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

/** Papel dentro da instituição (#26/#28), distinto de PlatformRole (#48). */
export const organizationRoles = ['ADMIN', 'VOLUNTEER'] as const
export const organizationRoleSchema = z.enum(organizationRoles)
export type OrganizationRole = z.infer<typeof organizationRoleSchema>

export const organizationCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    initials: z.string().trim().min(1).max(10),
    description: z.string().trim().min(1).max(2_000),
    city: z.string().trim().min(2).max(160),
    contactEmail: z.email().trim().toLowerCase(),
    phone: z.string().trim().min(8).max(30),
    logoUrl: z.url().optional(),
    cnpj: z.string().trim().min(14).max(18).optional(),
  })
  .strict()

export const organizationIdParamsSchema = z.object({ organizationId: z.string().min(1) }).strict()
export const organizationMemberParamsSchema = organizationIdParamsSchema.extend({
  userId: z.string().min(1),
})
export const organizationInvitationParamsSchema = organizationIdParamsSchema.extend({
  invitationId: z.string().min(1),
})
export const invitationTokenParamsSchema = z.object({ token: z.string().min(20) }).strict()

export const organizationInvitationCreateSchema = z
  .object({
    email: z.email().trim().toLowerCase(),
    role: organizationRoleSchema,
  })
  .strict()

export const organizationMemberRoleSchema = z.object({ role: organizationRoleSchema }).strict()

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  description: z.string(),
  city: z.string(),
  contactEmail: z.string(),
  phone: z.string(),
  logoUrl: z.string().nullable(),
  cnpj: z.string().nullable(),
})

export const organizationMembershipSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  role: organizationRoleSchema,
  status: z.enum(['ATIVO', 'REMOVIDO']),
  joinedAt: z.string(),
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }).optional(),
})

export const organizationInvitationResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: organizationRoleSchema,
  expiresAt: z.string(),
  status: z.enum(['PENDENTE', 'ACEITO', 'EXPIRADO', 'REVOGADO']),
  acceptUrl: z.string(),
})

export const organizationCreateResponseSchema = organizationSchema.extend({
  membership: organizationMembershipSchema,
})

export type OrganizationCreatePayload = z.infer<typeof organizationCreateSchema>
export type OrganizationInvitationCreatePayload = z.infer<typeof organizationInvitationCreateSchema>
export type OrganizationMemberRolePayload = z.infer<typeof organizationMemberRoleSchema>

export const organizationPermissions = [
  'requests:view',
  'requests:review',
  'requests:approve',
  'requests:reject',
] as const
export const organizationPermissionSchema = z.enum(organizationPermissions)
export type OrganizationPermission = z.infer<typeof organizationPermissionSchema>

export const permissionsForOrganizationRole = (role: OrganizationRole): OrganizationPermission[] =>
  role === 'ADMIN'
    ? [...organizationPermissions]
    : ['requests:view', 'requests:review', 'requests:reject']

export const organizationPermissionsResponseSchema = z.object({
  role: organizationRoleSchema,
  canApprove: z.boolean(),
  permissions: z.array(organizationPermissionSchema),
  organization: z.object({ id: z.string(), name: z.string(), initials: z.string() }).nullable(),
})
export type OrganizationPermissionsResponse = z.infer<typeof organizationPermissionsResponseSchema>

/** Etapas da fila da instituição — mesma origem para API, web e mock. */
export const organizationRequestStages = [
  'all',
  'new',
  'interview',
  'interview-done',
  'approved',
  'closed',
] as const
export const organizationRequestStageSchema = z.enum(organizationRequestStages)
export type OrganizationRequestStage = z.infer<typeof organizationRequestStageSchema>
export type RequestStage = Exclude<OrganizationRequestStage, 'all'>

type StageSource = { status: string; interview?: unknown }

export function organizationRequestStageOf(request: StageSource): RequestStage {
  const code = requestStatusCodeOf(request.status)
  if (code === 'ENVIADA') return 'new'
  if (
    code === 'ANALISE_QUESTIONARIO' ||
    code === 'ENTREVISTA' ||
    code === 'VISITA_DOMICILIAR' ||
    code === 'DECISAO_FINAL'
  ) {
    const interview = request.interview
    const completed =
      typeof interview === 'object' &&
      interview !== null &&
      'completed' in interview &&
      (interview as { completed?: unknown }).completed === true
    return completed ? 'interview-done' : 'interview'
  }
  if (code === 'APROVADA') return 'approved'
  return 'closed'
}

export const receivedRequestsQuerySchema = z.object({
  stage: organizationRequestStageSchema.optional().default('all'),
  petId: z.string().min(1).optional(),
})
export type ReceivedRequestsQuery = z.infer<typeof receivedRequestsQuerySchema>

const stageCountSchema = z.number().int().nonnegative()
export const requestStageCountersSchema = z.object({
  all: stageCountSchema,
  new: stageCountSchema,
  interview: stageCountSchema,
  'interview-done': stageCountSchema,
  approved: stageCountSchema,
  closed: stageCountSchema,
})
export type RequestStageCounters = z.infer<typeof requestStageCountersSchema>

export function emptyRequestStageCounters(): RequestStageCounters {
  return { all: 0, new: 0, interview: 0, 'interview-done': 0, approved: 0, closed: 0 }
}

/** Payload da API de agendamento: a validação Zod também roda no backend. */
export const interviewApiSchema = z.object({
  type: z.enum(interviewTypes, 'Selecione o tipo de encontro.'),
  proposedSlots: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Informe o horário.')
        .refine(isFutureDateTime, 'Todos os horários precisam ser datas futuras.'),
    )
    .min(1, 'Proponha de 1 a 3 horários para a entrevista.')
    .max(3, 'Proponha no máximo 3 horários para a entrevista.'),
})
export type InterviewApiPayload = z.infer<typeof interviewApiSchema>

export const organizationTransitionTos = ['EM_ANALISE', 'APROVADA', 'RECUSADA'] as const
export const organizationTransitionSchema = z.object({
  to: z.enum(organizationTransitionTos, 'Transição não suportada'),
  reason: z.string().trim().max(500, 'O motivo deve ter no máximo 500 caracteres.').optional(),
})
export type OrganizationTransitionPayload = z.infer<typeof organizationTransitionSchema>

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
  /** Score calculado no backend (#19); ausente no mock legado cai no cálculo local. */
  matching: matchingScoreSchema.nullable().optional(),
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
  counters: requestStageCountersSchema.optional(),
  /** Catálogo da instituição para o filtro de pet, mesmo com a fila filtrada. */
  pets: z.array(requestPetSchema).optional(),
})

export type OrganizationPetFormData = z.input<typeof organizationPetFormSchema>
export type OrganizationPetPayload = z.output<typeof organizationPetPayloadSchema>
export type ReceivedRequest = z.infer<typeof receivedRequestSchema>
export type Interview = z.infer<typeof interviewSchema>
export type InterviewFormData = z.infer<typeof interviewFormSchema>
export type RejectionFormData = z.infer<typeof rejectionFormSchema>
