import type { Pet, Profile } from '../types'

interface CompatibilityCheck {
  ok: boolean
  good: string
  attention: string
}

interface CompatibilityResult {
  score: number
  level: 'Alta' | 'Média' | 'Baixa'
  good: CompatibilityCheck[]
  attention: CompatibilityCheck[]
}

export function calculateCompatibility(pet: Pet, profile: Profile): CompatibilityResult {
  const checks: CompatibilityCheck[] = [
    {
      ok: pet.energy !== 'Alta' || profile.activityLevel === 'Ativo',
      good: `Sua rotina ${profile.activityLevel.toLowerCase()} combina com o nível de energia de ${pet.name}.`,
      attention: `${pet.name} tem energia alta e pode precisar de mais atividade do que a sua rotina atual.`,
    },
    {
      ok: !pet.space.toLowerCase().includes('quintal') || profile.hasOutdoorArea,
      good: `Sua moradia atende à necessidade de espaço de ${pet.name}.`,
      attention: `${pet.name} se beneficia de área externa; planeje passeios e atividades extras.`,
    },
    {
      ok: pet.children || !profile.hasChildren,
      good: 'A composição da sua casa é adequada para este pet.',
      attention: `${pet.name} prefere uma casa sem crianças.`,
    },
    {
      ok: pet.otherPets || !profile.hasOtherPets,
      good: 'A convivência com os animais da casa tende a ser positiva.',
      attention: `${pet.name} prefere ser o único pet; será necessária uma adaptação cuidadosa.`,
    },
    {
      ok: !pet.specialCare || profile.acceptsSpecialCare,
      good: pet.specialCare
        ? 'Você informou disponibilidade para os cuidados especiais necessários.'
        : `${pet.name} não possui cuidados especiais contínuos.`,
      attention: `${pet.name} precisa de cuidados especiais que ainda não constam como disponíveis no seu perfil.`,
    },
    {
      ok: profile.experience !== 'Primeiro pet',
      good: 'Sua experiência anterior ajuda na adaptação e nos cuidados.',
      attention: 'Como será seu primeiro pet, uma rede de apoio será importante no início.',
    },
  ]
  const matched = checks.filter((item) => item.ok).length
  const score = Math.round((matched / checks.length) * 100)
  return {
    score,
    level: score >= 80 ? 'Alta' : score >= 55 ? 'Média' : 'Baixa',
    good: checks.filter((item) => item.ok),
    attention: checks.filter((item) => !item.ok),
  }
}
