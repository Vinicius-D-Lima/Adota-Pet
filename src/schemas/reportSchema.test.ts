import { describe, expect, it } from 'vitest'
import { validateReportAttachments } from './reportSchema'

describe('validateReportAttachments', () => {
  it('aceita até cinco imagens JPEG, PNG ou WebP de até 5 MB', () => {
    const files = Array.from(
      { length: 5 },
      (_, index) => new File(['image'], `foto-${index}.jpg`, { type: 'image/jpeg' }),
    )

    expect(validateReportAttachments(files)).toBe('')
  })

  it('recusa mais de cinco anexos e imagens maiores que 5 MB', () => {
    const tooMany = Array.from(
      { length: 6 },
      (_, index) => new File(['x'], `foto-${index}.png`, { type: 'image/png' }),
    )
    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.png', {
      type: 'image/png',
    })

    expect(validateReportAttachments(tooMany)).toBe('Você pode anexar no máximo 5 imagens.')
    expect(validateReportAttachments([tooLarge])).toBe('Cada imagem deve ter no máximo 5 MB.')
  })
})
