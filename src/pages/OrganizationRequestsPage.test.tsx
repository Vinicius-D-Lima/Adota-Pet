import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { makeReceivedRequest } from '../test/fixtures/organization'
import { requestPet } from '../test/fixtures/requests'
import { renderWithProviders } from '../test/renderWithProviders'
import { OrganizationRequestsPage } from './OrganizationRequestsPage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const nina = { ...requestPet, id: 'nina', name: 'Nina' }

const list = (...data: ReturnType<typeof makeReceivedRequest>[]) => ({
  data,
  total: data.length,
})

afterEach(() => vi.clearAllMocks())

describe('OrganizationRequestsPage', () => {
  it('conta as etapas, filtra por etapa e por pet e leva ao detalhe', async () => {
    getMock.mockResolvedValue(
      list(
        makeReceivedRequest({ id: 'SOL-1', status: 'Enviada' }),
        makeReceivedRequest({
          id: 'SOL-2',
          petId: 'nina',
          pet: nina,
          adopter: { ...makeReceivedRequest().adopter, name: 'Marina Souza' },
        }),
        makeReceivedRequest({
          id: 'SOL-3',
          status: 'Em análise',
          interview: {
            type: 'Entrevista online',
            proposedSlots: ['2026-12-10T15:00:00.000Z'],
            status: 'REALIZADA',
            completed: true,
            completedAt: '2026-12-10T16:00:00.000Z',
          },
          adopter: { ...makeReceivedRequest().adopter, name: 'Paula Lima' },
        }),
        makeReceivedRequest({
          id: 'SOL-4',
          status: 'Recusada',
          adopter: { ...makeReceivedRequest().adopter, name: 'Ana Reis' },
        }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<OrganizationRequestsPage />)

    expect(await screen.findByRole('button', { name: 'Todas: 4 solicitações' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Novas: 1 solicitação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Em entrevista: 1 solicitação' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Entrevista realizada: 1 solicitação' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprovadas: 0 solicitações' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encerradas: 1 solicitação' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Em entrevista: 1 solicitação' }))
    expect(
      screen.getByRole('link', { name: /Analisar solicitação SOL-2 de Marina Souza para Nina/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Analisar solicitação SOL-1/ }),
    ).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por pet'), 'nina')
    expect(screen.getByRole('link', { name: /Analisar solicitação SOL-2/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /SOL-3/ })).not.toBeInTheDocument()
  })

  it('mostra estado vazio quando nenhuma solicitação combina com o filtro', async () => {
    getMock.mockResolvedValue(list(makeReceivedRequest({ status: 'Enviada' })))
    const user = userEvent.setup()
    renderWithProviders(<OrganizationRequestsPage />)

    await user.click(await screen.findByRole('button', { name: 'Aprovadas: 0 solicitações' }))
    expect(screen.getByText('Nenhuma solicitação com estes filtros')).toBeInTheDocument()
  })
})
