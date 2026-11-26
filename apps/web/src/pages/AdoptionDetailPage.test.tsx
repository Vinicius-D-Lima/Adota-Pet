import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdoptionsResponse, CheckIn } from '@adotapet/shared'
import { renderWithProviders } from '../test/renderWithProviders'
import { AdoptionDetailPage } from './AdoptionDetailPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  api: mocks,
}))

const response: AdoptionsResponse = {
  data: [
    {
      id: 'ADO-SOL-1039',
      adoptedAt: '2026-08-20T12:00:00.000Z',
      pet: { id: 'fred', name: 'Fred' },
      plan: { durationDays: 90, intervalDays: 15 },
      checkIns: [
        {
          id: 'CHK-2001',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-11-10T12:00:00.000Z',
          status: 'ATRASADO',
          photos: [],
        },
        {
          id: 'CHK-2002',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-11-20T12:00:00.000Z',
          status: 'ENVIADO',
          report: 'Fred está se adaptando bem.',
          photos: ['obj-1'],
        },
        {
          id: 'CHK-2003',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-11-27T12:00:00.000Z',
          status: 'PENDENTE',
          photos: [],
        },
        {
          id: 'CHK-2004',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-12-12T12:00:00.000Z',
          status: 'PENDENTE',
          photos: [],
          reviewerComment: 'Envie uma foto do Fred brincando.',
        },
        {
          id: 'CHK-2005',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-12-27T12:00:00.000Z',
          status: 'REVISADO',
          report: 'Tudo ótimo.',
          photos: [],
          reviewerComment: 'Ótimo, continue assim!',
        },
        {
          id: 'CHK-2006',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2027-01-11T12:00:00.000Z',
          status: 'PENDENTE',
          photos: [],
        },
      ],
    },
  ],
  total: 1,
}

const submitted: CheckIn = {
  id: 'CHK-2001',
  adoptionId: 'ADO-SOL-1039',
  dueDate: '2026-11-10T12:00:00.000Z',
  status: 'ENVIADO',
  report: 'Ele já dorme tranquilo.',
  photos: ['obj-novo'],
  submittedAt: '2026-11-25T12:00:00.000Z',
}

const setup = () =>
  renderWithProviders(
    <Routes>
      <Route path="/adocoes/:adoptionId" element={<AdoptionDetailPage />} />
    </Routes>,
    { route: '/adocoes/ADO-SOL-1039' },
  )

beforeEach(() => {
  mocks.get.mockResolvedValue(response)
  mocks.post.mockImplementation((path: string) => {
    if (String(path).includes('/photos/')) {
      return Promise.resolve({
        url: '/files/obj-1?token=abc',
        expiresAt: '2099-01-01T00:00:00.000Z',
      })
    }
    return Promise.resolve(submitted)
  })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:preview'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  vi.clearAllMocks()
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('AdoptionDetailPage', () => {
  it('coloca check-ins atrasados no topo e mostra pedidos de mais informações', async () => {
    setup()

    expect(await screen.findByRole('heading', { name: 'Fred' })).toBeInTheDocument()
    const cards = await screen.findAllByRole('article')
    expect(within(cards[0]).getByText('Atrasado')).toBeInTheDocument()
    expect(
      screen.getByText('A organização pediu mais informações neste check-in.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ótimo, continue assim!')).toBeInTheDocument()
  })

  it('exibe as fotos usando a URL assinada devolvida pela API', async () => {
    setup()

    const photo = await screen.findByAltText('Foto 1 do check-in')
    await waitFor(() => expect(photo).toHaveAttribute('src', '/api/files/obj-1?token=abc'))
    expect(mocks.post).toHaveBeenCalledWith('/check-ins/CHK-2002/photos/obj-1/url')
  })

  it('recusa foto inválida antes de chamar o upload', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByRole('heading', { name: 'Fred' })

    await user.upload(screen.getByLabelText(/Fotos \(até 5\)/), [
      new File(['svg'], 'imagem.svg', { type: 'image/svg+xml' }),
    ])

    expect(await screen.findByText('Use fotos nos formatos JPEG, PNG ou WebP.')).toBeInTheDocument()
    expect(mocks.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/submit'),
      expect.anything(),
      expect.anything(),
    )
  })

  it('mostra prévia, progresso e atualiza o status depois do envio', async () => {
    const user = userEvent.setup()
    let finishSubmit: (checkIn: CheckIn) => void = () => {}
    mocks.post.mockImplementation((path: string, _body?: unknown, options?: unknown) => {
      if (String(path).includes('/submit')) {
        const onProgress = (options as { onUploadProgress?: (percent: number) => void })
          .onUploadProgress
        onProgress?.(50)
        return new Promise<CheckIn>((resolve) => {
          finishSubmit = resolve
        })
      }
      return Promise.resolve({
        url: '/files/obj-1?token=abc',
        expiresAt: '2099-01-01T00:00:00.000Z',
      })
    })

    setup()
    await screen.findByRole('heading', { name: 'Fred' })
    const file = new File(['png'], 'foto.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText(/Fotos \(até 5\)/)
    await user.upload(fileInput, file)
    expect(await screen.findByAltText('Prévia de foto.png')).toHaveAttribute('src', 'blob:preview')

    const form = fileInput.closest('form') as HTMLFormElement
    await user.type(within(form).getByLabelText(/Relato/), 'Ele já dorme tranquilo.')
    await user.click(within(form).getByRole('button', { name: 'Enviar check-in' }))

    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    await act(async () => finishSubmit(submitted))

    expect(await screen.findByText(/3 de 6 check-ins enviados/)).toBeInTheDocument()
    expect(screen.getAllByText('Enviado').length).toBeGreaterThan(0)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
