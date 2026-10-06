import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../test/fixtures/profile'
import { petFixture } from '../test/petFixture'
import type { Pet, ProfileDraft } from '../types'
import { calculateCompatibility } from './calculateCompatibility'

const pet: Pet = { ...petFixture, name: 'Teste' }

const profile: ProfileDraft = {
  ...emptyProfile,
  activityLevel: 'Moderado',
  hasOutdoorArea: false,
  hasChildren: false,
  hasOtherPets: false,
  experience: 'Já tive pets',
  acceptsSpecialCare: true,
}

describe('calculateCompatibility', () => {
  it('retorna nível Alta quando todos os critérios são atendidos', () => {
    const result = calculateCompatibility(pet, profile)
    expect(result.score).toBe(100)
    expect(result.level).toBe('Alta')
    expect(result.attention).toHaveLength(0)
  })

  it('retorna nível Média com score entre 55 e 79', () => {
    const result = calculateCompatibility(
      { ...pet, children: false, otherPets: false },
      { ...profile, hasChildren: true, hasOtherPets: true },
    )
    expect(result.score).toBe(71)
    expect(result.level).toBe('Média')
    expect(result.attention).toHaveLength(2)
  })

  it('retorna nível Baixa com score abaixo de 55', () => {
    const result = calculateCompatibility(
      { ...pet, energy: 'Alta', space: 'Casa com quintal', children: false, otherPets: false },
      { ...profile, activityLevel: 'Tranquilo', hasChildren: true, hasOtherPets: true },
    )
    expect(result.score).toBe(43)
    expect(result.level).toBe('Baixa')
  })

  it('considera o primeiro pet como ponto de atenção', () => {
    const result = calculateCompatibility(pet, { ...profile, experience: 'Primeiro pet' })
    expect(result.score).toBe(86)
    expect(result.level).toBe('Alta')
    expect(result.attention).toHaveLength(1)
  })

  it('trata pouco tempo diante de energia alta como ponto de atenção', () => {
    const result = calculateCompatibility(
      { ...pet, energy: 'Alta' },
      { ...profile, activityLevel: 'Ativo', dailyTime: 'Até 1 hora' },
    )
    expect(result.score).toBe(86)
    expect(result.attention).toHaveLength(1)
    expect(result.attention[0].attention).toContain('energia alta')
  })

  it('não penaliza quando dailyTime está vazio ou há tempo suficiente', () => {
    const energetic = { ...pet, energy: 'Alta' }
    const active = { ...profile, activityLevel: 'Ativo' as const }
    expect(calculateCompatibility(energetic, { ...active, dailyTime: '' }).score).toBe(100)
    expect(calculateCompatibility(energetic, { ...active, dailyTime: '2 a 3 horas' }).score).toBe(
      100,
    )
    expect(calculateCompatibility(pet, { ...profile, dailyTime: 'Até 1 hora' }).score).toBe(100)
  })
})
