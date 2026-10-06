import { describe, expect, it } from 'vitest'
import { validProfile } from '../test/fixtures/profile'
import type { GuardianProfileDraft } from '../schemas/guardianProfileSchema'
import { calculateProfileCompletion } from './profileCompletion'

describe('calculateProfileCompletion', () => {
  it('considera o perfil de adotante completo sem tratar respostas false como ausentes', () => {
    const result = calculateProfileCompletion('adopter', {
      ...validProfile,
      hasOutdoorArea: false,
      hasChildren: false,
      hasOtherPets: false,
      acceptsSpecialCare: false,
    })

    expect(result).toMatchObject({ percentage: 100, isComplete: true, missingFields: [] })
  })

  it('retorna percentual e campos pendentes dinamicamente', () => {
    const result = calculateProfileCompletion('adopter', {
      ...validProfile,
      housing: '',
      dailyTime: '',
    })

    expect(result.isComplete).toBe(false)
    expect(result.percentage).toBeLessThan(100)
    expect(result.missingFields.map(({ key }) => key)).toEqual(['housing', 'dailyTime'])
  })

  it('aplica os campos específicos da organização', () => {
    const organization: GuardianProfileDraft = {
      guardianType: 'ORGANIZATION',
      displayName: '',
      legalName: 'Instituto Patinhas de Proteção Animal',
      document: '11222333000181',
      email: 'contato@patinhas.org',
      phone: '11999999999',
      zipCode: '01310100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo, SP',
      description: 'Trabalho responsável de proteção e adoção animal.',
      acceptsTerms: true,
    }

    expect(calculateProfileCompletion('guardian', organization).missingFields).toEqual([
      { key: 'displayName', label: 'Nome público da instituição' },
    ])
  })
})
