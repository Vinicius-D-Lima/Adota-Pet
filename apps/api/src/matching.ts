import type { MatchingCheck, MatchingLevel, MatchingScore } from '@adotapet/shared'

type MatchingPet = {
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

/**
 * Compatibilidade pet × adotante (#19). Porta os critérios usados pela tela de
 * compatibilidade do adotante para que a instituição veja o mesmo resultado,
 * calculado no servidor e persistível no contrato da solicitação.
 */
export function calculateRequestMatching(
  pet: MatchingPet | null,
  adopter: MatchingAdopter,
): MatchingScore | null {
  if (!pet) return null

  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value ? value : fallback
  const activityLevel = text(adopter.activityLevel, 'Moderado')
  const dailyTime = text(adopter.dailyTime, 'Não informado')
  const experience = adopter.experience === 'Primeiro pet' ? 'Primeiro pet' : undefined
  const hasOutdoorArea = adopter.hasOutdoorArea === true
  const hasChildren = adopter.hasChildren === true
  const hasOtherPets = adopter.hasOtherPets === true
  const acceptsSpecialCare = adopter.acceptsSpecialCare === true

  const checks: MatchingCheck[] = [
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

  const matched = checks.filter((item) => item.ok).length
  const score = Math.round((matched / checks.length) * 100)
  const level: MatchingLevel = score >= 80 ? 'Alta' : score >= 55 ? 'Média' : 'Baixa'

  return {
    score,
    level,
    good: checks.filter((item) => item.ok),
    attention: checks.filter((item) => !item.ok),
  }
}
