import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { makeRequest } from '../test/fixtures/requests'
import { renderWithProviders } from '../test/renderWithProviders'
import { RequestsPage } from './RequestsPage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)

const list = (...data: ReturnType<typeof makeRequest>[]) => ({ data, total: data.length })

afterEach(() => {
  vi.clearAllMocks()
})

describe('RequestsPage', () => {
  it('mostra a data em pt-BR, nunca em ISO cru', async () => {
    getMock.mockResolvedValue(list(makeRequest({ date: '2026-09-08T12:00:00.000Z' })))
    renderWithProviders(<RequestsPage />)

    expect(await screen.findByText(/enviada em 08 de set\.? de 2026/i)).toBeInTheDocument()
    expect(screen.queryByText(/2026-09-08/)).not.toBeInTheDocument()
  })

  it.each([
    ['Enviada', true],
    ['Em análise', true],
    ['Aprovada', false],
    ['Recusada', false],
    ['Cancelada', false],
  ] as const)('botão Cancelar com status %s: visível = %s', async (status, visible) => {
    getMock.mockResolvedValue(list(makeRequest({ status })))
    renderWithProviders(<RequestsPage />)

    await screen.findByText('SOL-1042')
    const button = screen.queryByRole('button', { name: /cancelar/i })
    expect(Boolean(button)).toBe(visible)
  })

  it('cancela com POST transitions { to: CANCELADA } e recarrega a lista', async () => {
    getMock
      .mockResolvedValueOnce(list(makeRequest({ status: 'Enviada' })))
      .mockResolvedValue(list(makeRequest({ status: 'Cancelada' })))
    postMock.mockResolvedValue(makeRequest({ status: 'Cancelada' }))
    renderWithProviders(<RequestsPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /cancelar/i }))

    expect(postMock).toHaveBeenCalledWith('/requests/SOL-1042/transitions', { to: 'CANCELADA' })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
  })

  it('409 ao cancelar mostra mensagem clara', async () => {
    getMock.mockResolvedValue(list(makeRequest({ status: 'Enviada' })))
    postMock.mockRejectedValue(new ApiError(409, 'Não é possível cancelar'))
    renderWithProviders(<RequestsPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /cancelar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não pode mais ser cancelada/i)
  })

  it('renderiza solicitação cujo pet veio null', async () => {
    getMock.mockResolvedValue(list(makeRequest({ pet: null })))
    renderWithProviders(<RequestsPage />)

    expect(await screen.findByText('Pet indisponível')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^ver /i })).not.toBeInTheDocument()
  })

  it('mostra o estado vazio', async () => {
    getMock.mockResolvedValue(list())
    renderWithProviders(<RequestsPage />)

    expect(await screen.findByText(/nenhuma solicitação ainda/i)).toBeInTheDocument()
  })
})
