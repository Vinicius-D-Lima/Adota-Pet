import { describe, expect, it } from 'vitest'
import { getInitials } from './getInitials'

describe('getInitials', () => {
  it('usa as iniciais das duas primeiras palavras', () => {
    expect(getInitials('maria da silva')).toBe('MD')
  })

  it('ignora espaços extras', () => {
    expect(getInitials('  ana   souza ')).toBe('AS')
  })

  it('retorna ? para nome vazio', () => {
    expect(getInitials('   ')).toBe('?')
  })
})
