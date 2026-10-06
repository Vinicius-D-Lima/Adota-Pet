import { describe, expect, it } from 'vitest'
import { formatRequestDate } from './formatRequestDate'

describe('formatRequestDate', () => {
  it('formata a data ISO em pt-BR, sem mostrar o ISO cru', () => {
    const result = formatRequestDate('2026-10-03T12:00:00Z')
    expect(result).toMatch(/^03 de out\.? de 2026$/)
    expect(result).not.toContain('T12')
  })

  it('devolve o texto original quando a data é inválida', () => {
    expect(formatRequestDate('não é data')).toBe('não é data')
  })
})
