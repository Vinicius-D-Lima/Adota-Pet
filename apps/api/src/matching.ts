import type { MatchingCheck, MatchingLevel, MatchingScore } from '@adotapet/shared'

export type MatchingPet = {
  name: string
  energy: string
  space: string
  children: boolean
  otherPets: boolean
  specialCare: boolean
}

/**
 * Campos do perfil do adotante usados nos 7 critérios (#19). O perfil da
 * solicitação vem de um JSON com tipagem frouxa, então cada campo é normalizado
 * antes de entrar no cálculo.
 */
export interface MatchingAdopter {
  activityLevel?: unknown
  hasOutdoorArea?: unknown
  dailyTime?: unknown
  hasChildren?: unknown
  hasOtherPets?: unknown
  acceptsSpecialCare?: unknown
  experience?: unknown
}

/** Pesos dos 7 critérios (MATCH-03/07). Padrão: pesos iguais, como no frontend. */
export interface MatchingWeights {
  energy: number
  space: number
  children: number
  otherPets: number
  specialCare: number
  experience: number
  dailyTime: number
}

export interface MatchingThresholds {
  high: number
  medium: number
}

/** Estratégia injetável: trocar o cálculo não exige mudar controllers (MATCH-07). */
export interface MatchingStrategy {
  calculate(pet: MatchingPet | null, adopter: MatchingAdopter): MatchingScore | null
}

const CHECK_KEYS: Array<keyof MatchingWeights> = [
  'energy',
  'space',
  'children',
  'otherPets',
  'specialCare',
  'experience',
  'dailyTime',
]

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  energy: 1,
  space: 1,
  children: 1,
  otherPets: 1,
  specialCare: 1,
  experience: 1,
  dailyTime: 1,
}

export const DEFAULT_MATCHING_THRESHOLDS: MatchingThresholds = { high: 80, medium: 55 }

/** Níveis e limites do contrato: alta a partir de 80, média a partir de 55. */
export function matchingLevelForScore(
  score: number,
  thresholds: MatchingThresholds = DEFAULT_MATCHING_THRESHOLDS,
): MatchingLevel {
  return score >= thresholds.high ? 'Alta' : score >= thresholds.medium ? 'Média' : 'Baixa'
}

/**
 * Compatibilidade pet × adotante (#19). Porta os critérios usados pela tela de
 * compatibilidade do adotante para que a instituição veja o mesmo resultado,
 * calculado no servidor e persistível no contrato da solicitação.
 */
function buildChecks(pet: MatchingPet, adopter: MatchingAdopter): MatchingCheck[] {
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value ? value : fallback
  const activityLevel = text(adopter.activityLevel, 'Moderado')
  const dailyTime = text(adopter.dailyTime, 'Não informado')
  const experience = adopter.experience === 'Primeiro pet' ? 'Primeiro pet' : undefined
  const hasOutdoorArea = adopter.hasOutdoorArea === true
  const hasChildren = adopter.hasChildren === true
  const hasOtherPets = adopter.hasOtherPets === true
  const acceptsSpecialCare = adopter.acceptsSpecialCare === true

  return [
    {
      ok: pet.energy !== 'Alta' || activityLevel === 'Ativo',
      good: `Sua rotina ${activityLevel.toLowerCase()} combina com o nível de energia de ${pet.name}.`,
      attention: `${pet.name} tem energia alta e pode precisar de mais atividade do que a sua rotina atual.`,
    },
    {
      ok: !pet.space.toLowerCase().includes('quintal') || hasOutdoorArea,
      good: `Sua moradia atende à necessidade de espaço de ${pet.name}.`,
      attention: `${pet.name} se beneficia de área externa; planeje passeios e atividades extras.`,
    },
    {
      ok: pet.children || !hasChildren,
      good: 'A composição da sua casa é adequada para este pet.',
      attention: `${pet.name} prefere uma casa sem crianças.`,
    },
    {
      ok: pet.otherPets || !hasOtherPets,
      good: 'A convivência com os animais da casa tende a ser positiva.',
      attention: `${pet.name} prefere ser o único pet; será necessária uma adaptação cuidadosa.`,
    },
    {
      ok: !pet.specialCare || acceptsSpecialCare,
      good: pet.specialCare
        ? 'Você informou disponibilidade para os cuidados especiais necessários.'
        : `${pet.name} não possui cuidados especiais contínuos.`,
      attention: `${pet.name} precisa de cuidados especiais que ainda não constam como disponíveis no seu perfil.`,
    },
    {
      ok: experience !== 'Primeiro pet',
      good: 'Sua experiência anterior ajuda na adaptação e nos cuidados.',
      attention: 'Como será seu primeiro pet, uma rede de apoio será importante no início.',
    },
    {
      ok: !(pet.energy === 'Alta' && dailyTime === 'Até 1 hora'),
      good: `Seu tempo disponível (${dailyTime.toLowerCase()}) é compatível com a rotina de ${pet.name}.`,
      attention: `${pet.name} tem energia alta e pode precisar de mais tempo do que ${dailyTime.toLowerCase()} por dia.`,
    },
  ]
}

/** Cria a estratégia padrão (ou uma variante com pesos/limites diferentes). */
export function createMatchingStrategy(
  options: {
    weights?: Partial<MatchingWeights>
    thresholds?: Partial<MatchingThresholds>
  } = {},
): MatchingStrategy {
  const weights: MatchingWeights = { ...DEFAULT_MATCHING_WEIGHTS, ...options.weights }
  const thresholds: MatchingThresholds = {
    ...DEFAULT_MATCHING_THRESHOLDS,
    ...options.thresholds,
  }
  const totalWeight = CHECK_KEYS.reduce((sum, key) => sum + weights[key], 0)

  return {
    calculate(pet, adopter) {
      if (!pet) return null
      const checks = buildChecks(pet, adopter)
      const matchedWeight = checks.reduce(
        (sum, check, index) => sum + (check.ok ? weights[CHECK_KEYS[index]] : 0),
        0,
      )
      const score = Math.round((matchedWeight / totalWeight) * 100)
      return {
        score,
        level: matchingLevelForScore(score, thresholds),
        good: checks.filter((item) => item.ok),
        attention: checks.filter((item) => !item.ok),
      }
    },
  }
}

export const defaultMatchingStrategy = createMatchingStrategy()

/** Compatibilidade usada pelo detalhe da solicitação (#19/#20). */
export function calculateRequestMatching(
  pet: MatchingPet | null,
  adopter: MatchingAdopter,
): MatchingScore | null {
  return defaultMatchingStrategy.calculate(pet, adopter)
}
