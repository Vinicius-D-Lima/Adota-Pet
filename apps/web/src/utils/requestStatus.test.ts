import { describe, expect, it } from 'vitest'
import { canCancelRequest, isActiveRequest } from './requestStatus'

describe('canCancelRequest', () => {
  it.each([
    ['Enviada', true],
    ['Em análise', true],
    ['Aprovada', false],
    ['Recusada', false],
    ['Cancelada', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(canCancelRequest(status)).toBe(expected)
  })
})

describe('isActiveRequest', () => {
  it('considera inativas apenas Cancelada e Recusada', () => {
    expect(isActiveRequest('Aprovada')).toBe(true)
    expect(isActiveRequest('Cancelada')).toBe(false)
    expect(isActiveRequest('Recusada')).toBe(false)
  })
})
