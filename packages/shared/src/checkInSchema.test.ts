import { describe, expect, it } from 'vitest'
import {
  adoptionsResponseSchema,
  checkInSchema,
  checkInSubmitSchema,
  validateCheckInPhotos,
} from './checkInSchema.js'

const photo = (name: string, type = 'image/jpeg', size = 1024) =>
  new File([new Uint8Array(size)], name, { type })

describe('checkInSchema', () => {
  it('aceita a resposta de /me/adoptions com check-ins', () => {
    const parsed = adoptionsResponseSchema.parse({
      data: [
        {
          id: 'ADO-1',
          adoptedAt: '2026-08-20T12:00:00.000Z',
          pet: { id: 'fred', name: 'Fred' },
          plan: { durationDays: 90, intervalDays: 15 },
          checkIns: [
            {
              id: 'CHK-1',
              adoptionId: 'ADO-1',
              dueDate: '2026-11-10T12:00:00.000Z',
              status: 'ATRASADO',
              photos: [],
            },
          ],
        },
      ],
      total: 1,
    })

    expect(parsed.data[0].checkIns[0].status).toBe('ATRASADO')
    expect(parsed.data[0].checkIns[0].photos).toEqual([])
  })

  it('rejeita status desconhecido', () => {
    expect(
      checkInSchema.safeParse({
        id: 'CHK-1',
        adoptionId: 'ADO-1',
        dueDate: '2026-11-10T12:00:00.000Z',
        status: 'CANCELADO',
        photos: [],
      }).success,
    ).toBe(false)
  })

  it('exige relato não vazio no envio', () => {
    expect(checkInSubmitSchema.safeParse({ report: '  ' }).success).toBe(false)
    expect(checkInSubmitSchema.parse({ report: '  Tudo bem!  ' }).report).toBe('Tudo bem!')
  })
})

describe('validateCheckInPhotos', () => {
  it('aceita até 5 fotos jpeg, png ou webp de até 5 MB', () => {
    expect(validateCheckInPhotos([photo('a.jpg'), photo('b.png', 'image/png')])).toBe('')
  })

  it('recusa mais de 5 fotos antes do upload', () => {
    const files = Array.from({ length: 6 }, (_, index) => photo(`${index}.jpg`))
    expect(validateCheckInPhotos(files)).toBe('Escolha no máximo 5 fotos.')
  })

  it('recusa formato fora da lista com mensagem específica', () => {
    expect(validateCheckInPhotos([photo('x.svg', 'image/svg+xml')])).toBe(
      'Use fotos nos formatos JPEG, PNG ou WebP.',
    )
  })

  it('recusa foto acima de 5 MB com mensagem específica', () => {
    expect(validateCheckInPhotos([photo('grande.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)])).toBe(
      'Cada foto deve ter no máximo 5 MB.',
    )
  })
})
