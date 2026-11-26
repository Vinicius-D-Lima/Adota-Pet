import type { OrganizationRole } from '@adotapet/shared'
import {
  subject,
  type Ability,
  type ForcedSubject,
  type RawRuleOf,
  type TaggedSubject,
} from '@casl/ability'
import {
  accessibleBy as caslAccessibleBy,
  createPrismaAbility,
  type PrismaQueryOf,
} from '@casl/prisma/runtime'
import {
  Prisma,
  type Adoption,
  type AdoptionRequest,
  type Appointment,
  type ChatMessage,
  type CheckIn,
  type Invitation,
  type MedicalRecord,
  type Membership,
  type Organization,
  type Pet,
  type Report,
} from './generated/prisma/client.js'

/** Papéis avaliados pela API: dois da organização e dois da plataforma. */
export type AccessRole = OrganizationRole | 'ADOTANTE' | 'MODERADOR'

/** Nomes usados no contrato público (frontend/mock). */
export type PublicResource =
  | 'Organization'
  | 'Member'
  | 'Invitation'
  | 'Pet'
  | 'Request'
  | 'Adoption'
  | 'MedicalRecord'
  | 'Appointment'
  | 'ChatMessage'
  | 'Report'
  | 'CheckIn'

/** Nomes dos modelos do Prisma, usados pelo `@casl/prisma`. */
export type ModelResource =
  | 'Organization'
  | 'Membership'
  | 'Invitation'
  | 'Pet'
  | 'AdoptionRequest'
  | 'Adoption'
  | 'MedicalRecord'
  | 'Appointment'
  | 'ChatMessage'
  | 'Report'
  | 'CheckIn'

export type AccessAction =
  'read' | 'create' | 'update' | 'delete' | 'manage' | 'review' | 'reject' | 'approve'

type Tagged<T extends ModelResource, M> = M & ForcedSubject<T>

export type AppSubject =
  | ModelResource
  | Tagged<'Organization', Organization>
  | Tagged<'Membership', Membership>
  | Tagged<'Invitation', Invitation>
  | Tagged<'Pet', Pet>
  | Tagged<'AdoptionRequest', AdoptionRequest>
  | Tagged<'Adoption', Adoption>
  | Tagged<'MedicalRecord', MedicalRecord>
  | Tagged<'Appointment', Appointment>
  | Tagged<'ChatMessage', ChatMessage>
  | Tagged<'Report', Report>
  | Tagged<'CheckIn', CheckIn>

/** Wrapper exigido pelo Prisma 7 (cliente gerado em caminho customizado). */
type AppPrismaQuery = PrismaQueryOf<Prisma.TypeMap>
export type AppAbility = Ability<[AccessAction, AppSubject], AppPrismaQuery, TaggedSubject>

export interface AbilityGrant {
  /** Papéis de organização são escopados; papéis da plataforma não herdam ONG. */
  role: AccessRole
  organizationIds?: string[]
}

export interface PublicRule {
  action: AccessAction
  subject: PublicResource
  conditions?: { organizationId: string }
}

interface RuleTemplate {
  action: AccessAction
  subject: ModelResource
  /** `false` = regra da plataforma, sem vínculo com uma organização. */
  organizationScoped?: boolean
}

/**
 * Fonte única das regras. A matriz do README e as regras devolvidas a
 * `/me/permissions` são derivadas desta tabela (RBAC-01/RBAC-09).
 */
const RULE_TEMPLATES: Record<AccessRole, RuleTemplate[]> = {
  ADMIN: [
    { action: 'manage', subject: 'Organization' },
    { action: 'manage', subject: 'Membership' },
    { action: 'manage', subject: 'Invitation' },
    { action: 'manage', subject: 'Pet' },
    { action: 'manage', subject: 'Adoption' },
    { action: 'manage', subject: 'MedicalRecord' },
    { action: 'manage', subject: 'Appointment' },
    { action: 'manage', subject: 'ChatMessage' },
    { action: 'read', subject: 'AdoptionRequest' },
    { action: 'review', subject: 'AdoptionRequest' },
    { action: 'reject', subject: 'AdoptionRequest' },
    { action: 'approve', subject: 'AdoptionRequest' },
  ],
  VOLUNTEER: [
    { action: 'read', subject: 'Organization' },
    { action: 'read', subject: 'Pet' },
    { action: 'create', subject: 'Pet' },
    { action: 'update', subject: 'Pet' },
    { action: 'read', subject: 'MedicalRecord' },
    { action: 'update', subject: 'MedicalRecord' },
    { action: 'create', subject: 'Appointment' },
    { action: 'read', subject: 'ChatMessage' },
    { action: 'create', subject: 'ChatMessage' },
    { action: 'read', subject: 'Adoption' },
    { action: 'read', subject: 'AdoptionRequest' },
    { action: 'review', subject: 'AdoptionRequest' },
    { action: 'reject', subject: 'AdoptionRequest' },
  ],
  ADOTANTE: [
    { action: 'create', subject: 'AdoptionRequest', organizationScoped: false },
    { action: 'update', subject: 'AdoptionRequest', organizationScoped: false },
    { action: 'create', subject: 'CheckIn', organizationScoped: false },
  ],
  MODERADOR: [{ action: 'manage', subject: 'Report', organizationScoped: false }],
}

const MODEL_TO_PUBLIC: Record<ModelResource, PublicResource> = {
  Organization: 'Organization',
  Membership: 'Member',
  Invitation: 'Invitation',
  Pet: 'Pet',
  AdoptionRequest: 'Request',
  Adoption: 'Adoption',
  MedicalRecord: 'MedicalRecord',
  Appointment: 'Appointment',
  ChatMessage: 'ChatMessage',
  Report: 'Report',
  CheckIn: 'CheckIn',
}

/** Condição CASL/Prisma que limita a regra às organizações informadas. */
function conditionsFor(model: ModelResource, organizationIds: string[]): Record<string, unknown> {
  if (model === 'Organization') return { id: { in: organizationIds } }
  if (model === 'AdoptionRequest') {
    // A tabela não tem organizationId: o escopo vem do pet relacionado.
    return { pet: { is: { organizationId: { in: organizationIds } } } }
  }
  return { organizationId: { in: organizationIds } }
}

const asPrismaQuery = (conditions: Record<string, unknown>) => conditions as AppPrismaQuery

/** Subject taggingado para checagens pontuais (`ability.can`) fora do Prisma. */
export function abilitySubject(model: ModelResource, organizationId: string): AppSubject {
  const data =
    model === 'Organization'
      ? { id: organizationId }
      : model === 'AdoptionRequest'
        ? { pet: { organizationId } }
        : { organizationId }
  return subject(model, data) as AppSubject
}

/**
 * Cria a habilidade CASL. Regras de organização exigem vínculo ativo; papéis da
 * plataforma recebem só as regras próprias (`MODERADOR` nunca ganha permissão
 * de organização — RBAC-06).
 */
export function createAbility(grants: AbilityGrant | AbilityGrant[]): AppAbility {
  const list = Array.isArray(grants) ? grants : [grants]
  const rules: RawRuleOf<AppAbility>[] = []
  for (const { role, organizationIds } of list) {
    const scoped = [...new Set(organizationIds ?? [])].filter(Boolean)
    const isOrganizationRole = role === 'ADMIN' || role === 'VOLUNTEER'
    if (isOrganizationRole && scoped.length === 0) continue
    for (const template of RULE_TEMPLATES[role]) {
      const conditions =
        isOrganizationRole && template.organizationScoped !== false
          ? conditionsFor(template.subject, scoped)
          : undefined
      rules.push({
        action: template.action,
        subject: template.subject,
        ...(conditions ? { conditions: asPrismaQuery(conditions) } : {}),
      } as RawRuleOf<AppAbility>)
    }
  }
  return createPrismaAbility<AppAbility>(rules)
}

const isDenyAll = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || !('OR' in value)) return false
  const or = (value as { OR?: unknown }).OR
  return Array.isArray(or) && or.length === 0
}

const DENY_ALL: Record<ModelResource, Record<string, unknown>> = {
  Organization: { id: { in: [] } },
  Membership: { id: { in: [] } },
  Invitation: { id: { in: [] } },
  Pet: { id: { in: [] } },
  AdoptionRequest: { id: { in: [] } },
  Adoption: { id: { in: [] } },
  MedicalRecord: { id: { in: [] } },
  Appointment: { id: { in: [] } },
  ChatMessage: { id: { in: [] } },
  Report: { id: { in: [] } },
  CheckIn: { id: { in: [] } },
}

/**
 * Converte as regras CASL em `where` do Prisma via `@casl/prisma`. Quando não
 * há nenhuma regra, o adapter devolve `OR: []`; trocamos por uma condição
 * equivalente e aceita pelo cliente gerado, para falhar fechado sem depender
 * da extensão `createCaslExtension`.
 */
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: 'Organization',
): Prisma.OrganizationWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: 'Membership',
): Prisma.MembershipWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: 'Invitation',
): Prisma.InvitationWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: 'Pet',
): Prisma.PetWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: 'AdoptionRequest',
): Prisma.AdoptionRequestWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: 'Adoption',
): Prisma.AdoptionWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: MedicalRecordResource,
): Prisma.MedicalRecordWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: AppointmentResource,
): Prisma.AppointmentWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: ChatMessageResource,
): Prisma.ChatMessageWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: ReportResource,
): Prisma.ReportWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: CheckInResource,
): Prisma.CheckInWhereInput
export function accessibleBy(
  ability: AppAbility,
  action: AccessAction,
  model: ModelResource,
): Record<string, unknown> {
  const where = caslAccessibleBy(ability, action).ofType(model)
  return isDenyAll(where) ? DENY_ALL[model] : (where as Record<string, unknown>)
}

type MedicalRecordResource = 'MedicalRecord'
type AppointmentResource = 'Appointment'
type ChatMessageResource = 'ChatMessage'
type ReportResource = 'Report'
type CheckInResource = 'CheckIn'

/**
 * Regras publicadas em `/me/permissions` no formato consumido por `<Can>`.
 * Vêm da mesma tabela usada pelo CASL, não de uma lista paralela.
 */
export function publicRulesForRole(role: AccessRole, organizationId?: string): PublicRule[] {
  return RULE_TEMPLATES[role].map(({ action, subject: model, organizationScoped }) => {
    const scoped = role === 'ADMIN' || role === 'VOLUNTEER'
    if (!scoped || organizationScoped === false || !organizationId) {
      return { action, subject: MODEL_TO_PUBLIC[model] }
    }
    return { action, subject: MODEL_TO_PUBLIC[model], conditions: { organizationId } }
  })
}

/** Papéis da matriz do README, na ordem em que aparecem na issue #28. */
export const MATRIX_ROLES = ['ADMIN', 'VOLUNTÁRIO', 'ADOTANTE', 'MODERADOR'] as const
export type MatrixRole = (typeof MATRIX_ROLES)[number]

/** `null` representa a célula “–” (ação que não se aplica ao papel). */
export type MatrixCell = boolean | null

export interface MatrixCheck {
  action: string
  cells: Record<MatrixRole, MatrixCell>
  rules: Array<{
    action: AccessAction
    subject: ModelResource
    /** Regras de plataforma não recebem `organizationId` na condição. */
    scope: 'organization' | 'platform'
  }>
}

/** Espelha a matriz proposta na issue #28, documentada no README. */
export const MATRIX_CHECKS: MatrixCheck[] = [
  {
    action: 'Gerenciar membros e convites',
    cells: { ADMIN: true, VOLUNTÁRIO: false, ADOTANTE: false, MODERADOR: false },
    rules: [
      { action: 'manage', subject: 'Membership', scope: 'organization' },
      { action: 'manage', subject: 'Invitation', scope: 'organization' },
    ],
  },
  {
    action: 'Editar dados da organização',
    cells: { ADMIN: true, VOLUNTÁRIO: false, ADOTANTE: false, MODERADOR: false },
    rules: [{ action: 'update', subject: 'Organization', scope: 'organization' }],
  },
  {
    action: 'Cadastrar e editar pets da organização',
    cells: { ADMIN: true, VOLUNTÁRIO: true, ADOTANTE: false, MODERADOR: false },
    rules: [
      { action: 'create', subject: 'Pet', scope: 'organization' },
      { action: 'update', subject: 'Pet', scope: 'organization' },
    ],
  },
  {
    action: 'Editar prontuário médico',
    cells: { ADMIN: true, VOLUNTÁRIO: true, ADOTANTE: false, MODERADOR: false },
    rules: [{ action: 'update', subject: 'MedicalRecord', scope: 'organization' }],
  },
  {
    action: 'Conduzir etapas, agendar e conversar no chat',
    cells: { ADMIN: true, VOLUNTÁRIO: true, ADOTANTE: false, MODERADOR: false },
    rules: [
      { action: 'review', subject: 'AdoptionRequest', scope: 'organization' },
      { action: 'create', subject: 'Appointment', scope: 'organization' },
      { action: 'create', subject: 'ChatMessage', scope: 'organization' },
    ],
  },
  {
    action: 'Aprovar adoção (decisão final)',
    cells: { ADMIN: true, VOLUNTÁRIO: false, ADOTANTE: false, MODERADOR: false },
    rules: [{ action: 'approve', subject: 'AdoptionRequest', scope: 'organization' }],
  },
  {
    action: 'Recusar solicitação',
    cells: { ADMIN: true, VOLUNTÁRIO: true, ADOTANTE: false, MODERADOR: false },
    rules: [{ action: 'reject', subject: 'AdoptionRequest', scope: 'organization' }],
  },
  {
    action: 'Criar solicitação, cancelar a própria e enviar check-in',
    cells: { ADMIN: null, VOLUNTÁRIO: null, ADOTANTE: true, MODERADOR: null },
    rules: [
      { action: 'create', subject: 'AdoptionRequest', scope: 'platform' },
      { action: 'update', subject: 'AdoptionRequest', scope: 'platform' },
      { action: 'create', subject: 'CheckIn', scope: 'platform' },
    ],
  },
  {
    action: 'Moderar denúncias',
    cells: { ADMIN: false, VOLUNTÁRIO: false, ADOTANTE: false, MODERADOR: true },
    rules: [{ action: 'manage', subject: 'Report', scope: 'platform' }],
  },
]

const MATRIX_ORGANIZATION_ID = 'rbac-matrix-organization'

const roleGrant = (role: MatrixRole): AbilityGrant => {
  if (role === 'ADMIN') return { role, organizationIds: [MATRIX_ORGANIZATION_ID] }
  if (role === 'VOLUNTÁRIO') {
    return { role: 'VOLUNTEER', organizationIds: [MATRIX_ORGANIZATION_ID] }
  }
  return { role, organizationIds: [] }
}

/** Habilidade usada pelos testes RBAC-01/RBAC-09 para cada papel da matriz. */
export function abilityForMatrixRole(role: MatrixRole): AppAbility {
  return createAbility(roleGrant(role))
}

/** Alvo CASL de cada regra da célula (tagged quando a regra é de organização). */
export function matrixRuleTargets(check: MatrixCheck) {
  return check.rules.map((rule) => ({
    ...rule,
    target:
      rule.scope === 'organization'
        ? abilitySubject(rule.subject, MATRIX_ORGANIZATION_ID)
        : rule.subject,
  }))
}
