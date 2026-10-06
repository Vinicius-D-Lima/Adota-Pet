import type { GuardianProfileDraft } from '../schemas/guardianProfileSchema'
import type { ProfileDraft } from '../schemas/profileSchema'

export type ProfileKind = 'adopter' | 'guardian'

interface RequiredField<T> {
  key: keyof T
  label: string
  isComplete?: (value: T[keyof T], profile: T) => boolean
  applies?: (profile: T) => boolean
}

export interface ProfileCompletion {
  percentage: number
  completedFields: number
  totalFields: number
  isComplete: boolean
  missingFields: Array<{ key: string; label: string }>
}

const hasValue = (value: unknown) =>
  typeof value === 'boolean' ? true : typeof value === 'string' ? value.trim().length > 0 : value != null

export const adopterRequiredFields: RequiredField<ProfileDraft>[] = [
  { key: 'name', label: 'Nome completo' },
  { key: 'cpf', label: 'CPF' },
  { key: 'birthDate', label: 'Data de nascimento' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone/celular' },
  { key: 'zipCode', label: 'CEP' },
  { key: 'address', label: 'Endereço' },
  { key: 'housing', label: 'Tipo de moradia' },
  { key: 'hasOutdoorArea', label: 'Área externa segura' },
  { key: 'dailyTime', label: 'Tempo disponível por dia' },
  { key: 'activityLevel', label: 'Nível de atividade' },
  { key: 'hasChildren', label: 'Crianças na residência' },
  { key: 'hasOtherPets', label: 'Outros pets na residência' },
  { key: 'experience', label: 'Experiência com animais' },
  { key: 'acceptsSpecialCare', label: 'Disponibilidade para cuidados especiais' },
  { key: 'preferredSpecies', label: 'Espécie desejada' },
  { key: 'preferredSize', label: 'Porte desejado' },
]

export const guardianRequiredFields: RequiredField<GuardianProfileDraft>[] = [
  { key: 'guardianType', label: 'Tipo de responsável' },
  {
    key: 'displayName',
    label: 'Nome público da instituição',
    applies: (profile) => profile.guardianType === 'ORGANIZATION',
  },
  { key: 'legalName', label: 'Nome completo ou razão social' },
  { key: 'document', label: 'CPF ou CNPJ' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone/celular' },
  { key: 'zipCode', label: 'CEP' },
  { key: 'address', label: 'Endereço' },
  { key: 'city', label: 'Cidade e estado' },
  { key: 'description', label: 'Apresentação' },
  {
    key: 'acceptsTerms',
    label: 'Declaração de responsabilidade',
    isComplete: (value) => value === true,
  },
]

function calculate<T>(profile: T, fields: RequiredField<T>[]): ProfileCompletion {
  const applicable = fields.filter((field) => field.applies?.(profile) ?? true)
  const missingFields = applicable
    .filter((field) => !(field.isComplete?.(profile[field.key], profile) ?? hasValue(profile[field.key])))
    .map(({ key, label }) => ({ key: String(key), label }))
  const completedFields = applicable.length - missingFields.length
  return {
    percentage: Math.round((completedFields / applicable.length) * 100),
    completedFields,
    totalFields: applicable.length,
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

export function calculateProfileCompletion(
  kind: 'adopter',
  profile: ProfileDraft,
): ProfileCompletion
export function calculateProfileCompletion(
  kind: 'guardian',
  profile: GuardianProfileDraft,
): ProfileCompletion
export function calculateProfileCompletion(
  kind: ProfileKind,
  profile: ProfileDraft | GuardianProfileDraft,
): ProfileCompletion {
  return kind === 'adopter'
    ? calculate(profile as ProfileDraft, adopterRequiredFields)
    : calculate(profile as GuardianProfileDraft, guardianRequiredFields)
}
