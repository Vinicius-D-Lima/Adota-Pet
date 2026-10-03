import { describe, expect, it } from 'vitest'
import { initialProfile, pets } from '../data/pets'
import type { Pet, ProfileDraft } from '../types'
import { calculateCompatibility } from './calculateCompatibility'

const pet: Pet = {
  ...pets[0],
  name: 'Teste',
  energy: 'Média',
  space: 'Apartamento ou casa',
  children: true,
  otherPets: true,
  specialCare: false,
}

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
    // 2 critérios falham: crianças e outros pets (4 de 6 ≈ 67%)
    const result = calculateCompatibility(
      { ...pet, children: false, otherPets: false },
      { ...profile, hasChildren: true, hasOtherPets: true },
    )
    expect(result.score).toBe(67)
    expect(result.level).toBe('Média')
    expect(result.attention).toHaveLength(2)
  })

  it('retorna nível Baixa com score abaixo de 55', () => {
    // 4 critérios falham (2 de 6 ≈ 33%)
    const result = calculateCompatibility(
      { ...pet, energy: 'Alta', space: 'Casa com quintal', children: false, otherPets: false },
      { ...profile, activityLevel: 'Tranquilo', hasChildren: true, hasOtherPets: true },
    )
    expect(result.score).toBe(33)
    expect(result.level).toBe('Baixa')
    expect(result.good).toHaveLength(2)
  })

  it('considera o primeiro pet como ponto de atenção', () => {
    const result = calculateCompatibility(pet, { ...profile, experience: 'Primeiro pet' })
    expect(result.score).toBe(83)
    expect(result.level).toBe('Alta')
    expect(result.attention).toHaveLength(1)
  })
})
