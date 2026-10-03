import { describe, expect, it } from 'vitest'
import { getInitials } from './getInitials'

describe('getInitials', () => {
  it('usa as iniciais das duas primeiras palavras', () => {
    expect(getInitials('ana souza costa')).toBe('AS')
  })

  it('ignora conectivos como de, da, do, das, dos e e', () => {
    expect(getInitials('maria da silva')).toBe('MS')
  })

  it('ignora espaços extras', () => {
    expect(getInitials('  ana   souza ')).toBe('AS')
  })

  it('retorna ? para nome vazio', () => {
    expect(getInitials('   ')).toBe('?')
  })
})
