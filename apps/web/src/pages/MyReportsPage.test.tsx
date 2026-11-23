import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { MyReportsPage } from './MyReportsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

const reports = [
  {
    id: 'report-open',
    targetType: 'PET',
    targetId: 'luna',
    category: 'MAUS_TRATOS',
    description: 'O pet aparenta estar sem os cuidados necessários.',
    status: 'ABERTA',
    resolution: null,
    moderatorId: null,
    resolvedAt: null,
    createdAt: '2026-11-20T12:00:00.000Z',
    updatedAt: '2026-11-20T12:00:00.000Z',
    attachments: [],
  },
  {
    id: 'report-resolved',
    targetType: 'ORGANIZACAO',
    targetId: 'instituto-patinhas',
    category: 'FRAUDE',
    description: 'As informações divulgadas não correspondem aos fatos.',
    status: 'PROCEDENTE',
    resolution: 'A denúncia foi confirmada após análise da moderação.',
    moderatorId: 'moderator-1',
    resolvedAt: '2026-11-22T14:00:00.000Z',
    createdAt: '2026-11-19T12:00:00.000Z',
    updatedAt: '2026-11-22T14:00:00.000Z',
    attachments: [],
  },
]

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ data: reports, total: reports.length })
})

describe('MyReportsPage', () => {
  it('mostra as denúncias, seus status e a resposta da moderação', async () => {
    renderWithProviders(<MyReportsPage />, { route: '/minhas-denuncias' })

    expect(
      await screen.findByText('O pet aparenta estar sem os cuidados necessários.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A denúncia foi confirmada após análise da moderação.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Aberta')).toHaveLength(2)
    expect(screen.getAllByText('Procedente')).toHaveLength(2)
    expect(mocks.get).toHaveBeenCalledWith(
      '/me/reports',
      expect.objectContaining({ signal: expect.anything() }),
    )
  })

  it('filtra a lista pelo status escolhido', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MyReportsPage />, { route: '/minhas-denuncias' })
    await screen.findByText('O pet aparenta estar sem os cuidados necessários.')

    await user.click(screen.getByRole('button', { name: /Procedente/ }))

    expect(
      screen.queryByText('O pet aparenta estar sem os cuidados necessários.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('As informações divulgadas não correspondem aos fatos.'),
    ).toBeInTheDocument()
  })

  it('exibe um estado de erro e permite tentar novamente', async () => {
    mocks.get.mockRejectedValue(new Error('API indisponível'))
    const user = userEvent.setup()
    renderWithProviders(<MyReportsPage />, { route: '/minhas-denuncias' })

    expect(
      await screen.findByRole('heading', { name: 'Não foi possível carregar suas denúncias' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2))
  })
})
