import { describe, expect, it } from 'vitest'
import { reportSchema, resolveReportSchema, validateReportAttachments } from './reportSchema.js'

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

describe('schemas de denúncia', () => {
  it('valida criação sem aceitar campos privilegiados', () => {
    const result = reportSchema.safeParse({
      targetType: 'PET',
      targetId: 'pet-1',
      category: 'ABANDONO',
      description: 'O animal está sozinho há vários dias.',
      reporterId: 'usuario-forjado',
    })

    expect(result.success).toBe(false)
  })

  it('exige resolução para encerrar a denúncia', () => {
    expect(resolveReportSchema.safeParse({ status: 'PROCEDENTE', resolution: '' }).success).toBe(
      false,
    )
    expect(
      resolveReportSchema.safeParse({
        status: 'PROCEDENTE',
        resolution: 'A denúncia foi confirmada pela moderação.',
      }).success,
    ).toBe(true)
  })
})
