import { describe, expect, it } from 'vitest'
import { guardianProfileSchema } from './guardianProfileSchema'

const base = {
  guardianType: 'INDIVIDUAL' as const,
  displayName: 'Ana Protetora',
  legalName: 'Ana Maria Souza',
  document: '52998224725',
  email: 'ana@exemplo.com',
  phone: '11999999999',
  zipCode: '01310100',
  address: 'Avenida Paulista, 1000',
  city: 'São Paulo, SP',
  description: 'Trabalho com resgate e adoção responsável de cães e gatos.',
  acceptsTerms: true,
}

describe('guardianProfileSchema', () => {
  it('aceita um protetor independente com CPF válido', () => {
    expect(guardianProfileSchema.safeParse({ ...base, displayName: '' }).success).toBe(true)
  })

  it('aceita uma instituição com CNPJ válido', () => {
    expect(
      guardianProfileSchema.safeParse({
        ...base,
        guardianType: 'ORGANIZATION',
        document: '11222333000181',
      }).success,
    ).toBe(true)
  })

  it('exige nome público somente para instituição', () => {
    const result = guardianProfileSchema.safeParse({
      ...base,
      guardianType: 'ORGANIZATION',
      displayName: '',
      document: '11222333000181',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['displayName'])
  })

  it('rejeita documento incompatível e termo não confirmado', () => {
    const result = guardianProfileSchema.safeParse({
      ...base,
      document: '11111111111',
      acceptsTerms: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['document', 'acceptsTerms']),
      )
    }
  })
})
