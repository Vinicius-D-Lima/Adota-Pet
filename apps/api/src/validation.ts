import { profileSchema as sharedProfileSchema } from '@adotapet/shared'
import type { FieldError } from './http.js'
import { isBlank } from './http.js'
import { MAX_FOLLOW_UP_DURATION_DAYS } from './adoptions.js'

export const PROFILE_ENUMS: Record<string, string[]> = {
  housing: ['Apartamento', 'Casa', 'Chácara ou sítio'],
  dailyTime: ['Até 1 hora', '2 a 3 horas', 'Mais de 3 horas'],
  activityLevel: ['Tranquilo', 'Moderado', 'Ativo'],
  experience: ['Primeiro pet', 'Já tive pets', 'Tenho bastante experiência'],
  preferredSpecies: ['Sem preferência', 'Cachorro', 'Gato'],
  preferredSize: ['Sem preferência', 'Pequeno', 'Pequeno ou médio', 'Médio ou grande'],
}
const PROFILE_BOOLEANS = ['hasOutdoorArea', 'hasChildren', 'hasOtherPets', 'acceptsSpecialCare']
export const PROFILE_DIGITS = ['cpf', 'phone', 'zipCode']
/** Campos do perfil derivados do contrato compartilhado (MONO-03). */
export const PROFILE_FIELDS = Object.keys(sharedProfileSchema.shape) as Array<
  keyof typeof sharedProfileSchema.shape
>

const GUARDIAN_TYPES = ['INDIVIDUAL', 'ORGANIZATION']
export const GUARDIAN_FIELDS = [
  'guardianType',
  'displayName',
  'legalName',
  'document',
  'email',
  'phone',
  'zipCode',
  'address',
  'city',
  'description',
  'acceptsTerms',
] as const
export const GUARDIAN_DIGITS = ['document', 'phone', 'zipCode']
export const SAVED_FILTER_FIELDS = ['search', 'species', 'size', 'sex', 'city']
const SAVED_FILTER_ENUMS: Record<string, string[]> = {
  species: ['Cachorro', 'Gato'],
  size: ['Pequeno', 'Médio', 'Grande'],
  sex: ['Fêmea', 'Macho'],
}

export const ORGANIZATION_PET_FIELDS = [
  'name',
  'species',
  'breed',
  'age',
  'size',
  'sex',
  'city',
  'image',
  'summary',
  'description',
  'traits',
  'energy',
  'space',
  'children',
  'otherPets',
] as const

export const digitsOnly = (value: string) => value.replace(/\D/g, '')

export function isValidCpf(value: string): boolean {
  const cpf = digitsOnly(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calculateDigit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
}

export function isValidCnpj(value: string): boolean {
  const cnpj = digitsOnly(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const digit = (base: string, weights: number[]) => {
    const sum = base
      .split('')
      .reduce((total, number, index) => total + Number(number) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = digit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = digit(`${cnpj.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(cnpj[12]) && second === Number(cnpj[13])
}

function isAdult(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const birthDate = new Date(year, month - 1, day)
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  )
    return false
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day))
    age -= 1
  return age >= 18
}

/** Mesmas regras do profileSchema do frontend: [validação, mensagem]. */
const PROFILE_RULES: Record<string, readonly [(value: string) => boolean, string]> = {
  name: [(v) => v.trim().length >= 3, 'Informe seu nome completo.'],
  cpf: [isValidCpf, 'Informe um CPF válido.'],
  birthDate: [isAdult, 'É necessário ter pelo menos 18 anos.'],
  email: [(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), 'Informe um e-mail válido.'],
  phone: [(v) => /^\d{10,11}$/.test(digitsOnly(v)), 'Informe um telefone com DDD.'],
  zipCode: [(v) => /^\d{8}$/.test(digitsOnly(v)), 'Informe um CEP válido.'],
  address: [(v) => v.trim().length >= 5, 'Informe seu endereço.'],
}

/** Mensagem de erro do campo ou `null` quando o valor é válido. */
export function profileFieldError(key: string, value: unknown): string | null {
  if (PROFILE_BOOLEANS.includes(key)) {
    return typeof value === 'boolean' ? null : `${key} deve ser verdadeiro ou falso`
  }
  if (typeof value !== 'string') return `${key} deve ser um texto`
  if (PROFILE_ENUMS[key]) {
    return PROFILE_ENUMS[key].includes(value)
      ? null
      : `${key} deve ser um de: ${PROFILE_ENUMS[key].join(', ')}`
  }
  const rule = PROFILE_RULES[key]
  if (!rule) return null
  return rule[0](value) ? null : rule[1]
}

/** Campos exigidos pelo frontend ausentes ou inválidos no perfil salvo. */
export const missingProfileFields = (profile: Record<string, unknown>): string[] =>
  PROFILE_FIELDS.filter((key) => {
    const value = profile[key]
    return value === undefined || value === null || profileFieldError(key, value) !== null
  })

export function guardianFieldError(key: string, value: unknown, profile: Record<string, unknown>) {
  if (key === 'acceptsTerms')
    return typeof value === 'boolean' ? null : 'acceptsTerms deve ser booleano'
  if (typeof value !== 'string') return `${key} deve ser um texto`
  if (key === 'guardianType')
    return GUARDIAN_TYPES.includes(value) ? null : 'Escolha o tipo de responsável.'
  if (key === 'displayName' && profile.guardianType === 'INDIVIDUAL') return null
  if (key === 'document') {
    const valid = profile.guardianType === 'ORGANIZATION' ? isValidCnpj(value) : isValidCpf(value)
    return valid
      ? null
      : `Informe um ${profile.guardianType === 'ORGANIZATION' ? 'CNPJ' : 'CPF'} válido.`
  }
  if (key === 'email')
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : 'Informe um e-mail válido.'
  if (key === 'phone')
    return /^\d{10,11}$/.test(digitsOnly(value)) ? null : 'Informe um telefone com DDD.'
  if (key === 'zipCode') return /^\d{8}$/.test(digitsOnly(value)) ? null : 'Informe um CEP válido.'
  const minimum = key === 'description' ? 20 : key === 'city' ? 2 : key === 'address' ? 5 : 3
  return value.trim().length >= minimum
    ? null
    : key === 'description'
      ? 'Conte um pouco sobre o trabalho de proteção animal.'
      : `Preencha ${key}.`
}

export const missingGuardianFields = (profile: Record<string, unknown>): string[] =>
  GUARDIAN_FIELDS.filter((key) => {
    if (key === 'displayName' && profile.guardianType === 'INDIVIDUAL') return false
    const value = profile[key]
    if (key === 'acceptsTerms') return value !== true
    return value === undefined || value === null || guardianFieldError(key, value, profile) !== null
  })

/** `null`/`undefined` viram `undefined` (a chave some no JSON, como no mock). */
export const optional = <T>(value: T | null | undefined): T | undefined => value ?? undefined

/** Objeto JSON simples (nulo, array e primitivos são rejeitados). */
export function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null
}

export function validateSavedFilter(body: unknown, partial = false): FieldError[] {
  const details: FieldError[] = []
  const record = asRecord(body)
  if (!record) return [{ field: 'body', message: 'Envie um objeto JSON' }]

  for (const key of Object.keys(record)) {
    if (!['name', 'criteria', 'active'].includes(key)) {
      details.push({ field: key, message: 'Campo desconhecido' })
    }
  }
  if (!partial || Object.hasOwn(record, 'name')) {
    const name = record.name
    if (typeof name !== 'string' || isBlank(name) || name.trim().length > 80) {
      details.push({ field: 'name', message: 'Informe um nome com até 80 caracteres' })
    }
  }
  if (!partial || Object.hasOwn(record, 'criteria')) {
    const criteria = asRecord(record.criteria)
    if (!criteria) {
      details.push({ field: 'criteria', message: 'Informe os critérios como um objeto' })
    } else {
      for (const key of Object.keys(criteria)) {
        const value = criteria[key]
        if (!SAVED_FILTER_FIELDS.includes(key)) {
          details.push({ field: `criteria.${key}`, message: 'Critério desconhecido' })
        } else if (key === 'size') {
          const sizes = Array.isArray(value) ? value : []
          if (
            sizes.length === 0 ||
            sizes.some((item) => !SAVED_FILTER_ENUMS.size.includes(String(item))) ||
            new Set(sizes).size !== sizes.length
          ) {
            details.push({
              field: 'criteria.size',
              message: 'Informe portes válidos e sem repetição',
            })
          }
        } else if (SAVED_FILTER_ENUMS[key]) {
          if (typeof value !== 'string' || !SAVED_FILTER_ENUMS[key].includes(value)) {
            details.push({ field: `criteria.${key}`, message: `Valor inválido para ${key}` })
          }
        } else if (isBlank(value) || (key === 'city' && String(value).trim().length < 2)) {
          details.push({ field: `criteria.${key}`, message: 'Informe um valor válido' })
        }
      }
      if (Object.keys(criteria).length === 0) {
        details.push({ field: 'criteria', message: 'Informe ao menos um critério de busca' })
      }
    }
  }
  if (!partial || Object.hasOwn(record, 'active')) {
    if (typeof record.active !== 'boolean') {
      details.push({ field: 'active', message: 'active deve ser verdadeiro ou falso' })
    }
  }
  if (partial && Object.keys(record).length === 0) {
    details.push({ field: 'body', message: 'Informe ao menos um campo para atualizar' })
  }
  return details
}

export function validateFollowUpPlan(body: unknown): FieldError[] {
  const record = asRecord(body)
  if (!record) return [{ field: 'body', message: 'Envie um objeto JSON' }]

  const details: FieldError[] = []
  for (const key of Object.keys(record)) {
    if (!['durationDays', 'intervalDays'].includes(key)) {
      details.push({ field: key, message: 'Campo desconhecido' })
    }
  }

  const durationDays = record.durationDays
  if (
    typeof durationDays !== 'number' ||
    !Number.isSafeInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > MAX_FOLLOW_UP_DURATION_DAYS
  ) {
    details.push({
      field: 'durationDays',
      message: `durationDays deve ser um inteiro entre 1 e ${MAX_FOLLOW_UP_DURATION_DAYS}`,
    })
  }

  const intervalDays = record.intervalDays
  if (
    typeof intervalDays !== 'number' ||
    !Number.isSafeInteger(intervalDays) ||
    intervalDays < 1 ||
    (typeof durationDays === 'number' &&
      Number.isSafeInteger(durationDays) &&
      intervalDays > durationDays)
  ) {
    details.push({
      field: 'intervalDays',
      message: 'intervalDays deve ser um inteiro positivo até durationDays',
    })
  }

  return details
}

export function validateOrganizationPet(body: unknown): FieldError[] {
  const record = asRecord(body)
  if (!record) return [{ field: 'body', message: 'Envie um objeto JSON' }]

  const details: FieldError[] = []
  for (const key of ORGANIZATION_PET_FIELDS) {
    const value = record[key]
    if (key === 'age') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 30)
        details.push({ field: key, message: 'A idade deve ser um número entre 0 e 30' })
    } else if (key === 'traits') {
      if (!Array.isArray(value) || !value.length || value.some((item) => isBlank(item)))
        details.push({ field: key, message: 'Informe ao menos uma característica' })
    } else if (['children', 'otherPets'].includes(key)) {
      if (typeof value !== 'boolean')
        details.push({ field: key, message: 'Informe verdadeiro ou falso' })
    } else if (isBlank(value)) details.push({ field: key, message: `${key} é obrigatório` })
  }
  if (typeof record.image === 'string') {
    try {
      new URL(record.image)
    } catch {
      details.push({ field: 'image', message: 'Informe uma URL válida' })
    }
  }
  return details
}
