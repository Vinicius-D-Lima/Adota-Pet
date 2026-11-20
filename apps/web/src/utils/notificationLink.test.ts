import { describe, expect, it } from 'vitest'
import { getInternalNotificationPath } from './notificationLink'

describe('getInternalNotificationPath', () => {
  it('permite caminhos internos com query e fragmento', () => {
    expect(getInternalNotificationPath('/solicitacoes/123?aba=chat#mensagens')).toBe(
      '/solicitacoes/123?aba=chat#mensagens',
    )
  })

  it.each(['https://example.com', '//example.com', '/\\example.com'])(
    'recusa links externos ou ambíguos: %s',
    (link) => {
      expect(getInternalNotificationPath(link)).toBeNull()
    },
  )
})
