import { describe, expect, it } from 'vitest'
import { initialProfile } from '../data/appData'
import { petFixture } from '../test/petFixture'
import type { Pet, ProfileDraft } from '../types'
import { calculateCompatibility } from './calculateCompatibility'

const pet: Pet = { ...petFixture, name: 'Teste' }

const profile: ProfileDraft = {
  ...initialProfile,
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
    expect(result.score).toBe(67)
    expect(result.level).toBe('Média')
    expect(result.attention).toHaveLength(2)
  })

  it('retorna nível Baixa com score abaixo de 55', () => {
    const result = calculateCompatibility(
      { ...pet, energy: 'Alta', space: 'Casa com quintal', children: false, otherPets: false },
      { ...profile, activityLevel: 'Tranquilo', hasChildren: true, hasOtherPets: true },
    )
    expect(result.score).toBe(33)
    expect(result.level).toBe('Baixa')
  })
})
