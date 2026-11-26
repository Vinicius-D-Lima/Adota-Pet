import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdoptionsResponse } from '@adotapet/shared'
import { api } from '../lib/api'
import { renderWithProviders } from '../test/renderWithProviders'
import { MyAdoptionsPage } from './MyAdoptionsPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

const getMock = vi.mocked(api.get)

const response: AdoptionsResponse = {
  data: [
    {
      id: 'ADO-SOL-1039',
      adoptedAt: '2026-08-20T12:00:00.000Z',
      pet: { id: 'fred', name: 'Fred', organization: 'Instituto Patinhas' },
      plan: { durationDays: 90, intervalDays: 15 },
      checkIns: [
        {
          id: 'CHK-1',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-11-10T12:00:00.000Z',
          status: 'ATRASADO',
          photos: [],
        },
        {
          id: 'CHK-2',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-11-20T12:00:00.000Z',
          status: 'ENVIADO',
          photos: [],
        },
        {
          id: 'CHK-3',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-11-27T12:00:00.000Z',
          status: 'PENDENTE',
          photos: [],
        },
        {
          id: 'CHK-4',
          adoptionId: 'ADO-SOL-1039',
          dueDate: '2026-12-12T12:00:00.000Z',
          status: 'REVISADO',
          photos: [],
        },
      ],
    },
  ],
  total: 1,
}

beforeEach(() => {
  getMock.mockResolvedValue(response)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('MyAdoptionsPage', () => {
  it('mostra o progresso de check-ins e o atalho para o detalhe', async () => {
    renderWithProviders(<MyAdoptionsPage />)

    expect(await screen.findByRole('heading', { name: 'Minhas adoções' })).toBeInTheDocument()
    expect(await screen.findByText('2 de 4 check-ins enviados')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByRole('link', { name: 'Ver acompanhamento' })).toHaveAttribute(
      'href',
      '/adocoes/ADO-SOL-1039',
    )
  })

  it('destaca quantos check-ins estão atrasados', async () => {
    renderWithProviders(<MyAdoptionsPage />)

    expect(await screen.findByText(/1 atrasado/)).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há adoções', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    renderWithProviders(<MyAdoptionsPage />)

    expect(await screen.findByText('Você ainda não tem adoções concluídas')).toBeInTheDocument()
  })

  it('permite tentar novamente depois de falha na API', async () => {
    getMock.mockRejectedValueOnce(new Error('rede'))
    const user = userEvent.setup()
    renderWithProviders(<MyAdoptionsPage />)

    expect(await screen.findByText('Não foi possível carregar suas adoções')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
  })
})
