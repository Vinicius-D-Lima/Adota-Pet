import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adoptionRequestKeys } from '../hooks/useAdoptionRequests'
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
  it('divide as solicitações por estágio, mostra contagens e filtra a lista', async () => {
    getMock.mockResolvedValue(
      list(
        makeRequest({ id: 'SOL-1', status: 'Enviada' }),
        makeRequest({ id: 'SOL-2', status: 'Em análise' }),
        makeRequest({ id: 'SOL-3', status: 'Aprovada' }),
        makeRequest({ id: 'SOL-4', status: 'Recusada' }),
        makeRequest({ id: 'SOL-5', status: 'Cancelada' }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<RequestsPage />)

    expect(await screen.findByRole('button', { name: 'Todas: 5 solicitações' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Encerradas: 2 solicitações' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Em análise: 1 solicitação' }))
    expect(screen.getByText('SOL-2')).toBeInTheDocument()
    expect(screen.queryByText('SOL-1')).not.toBeInTheDocument()
    expect(screen.queryByText('SOL-3')).not.toBeInTheDocument()
    expect(screen.getByText('1 solicitação')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Encerradas: 2 solicitações' }))
    expect(screen.getByText('SOL-4')).toBeInTheDocument()
    expect(screen.getByText('SOL-5')).toBeInTheDocument()
    expect(screen.queryByText('SOL-2')).not.toBeInTheDocument()
  })

  it('mostra um estado vazio apenas para o estágio selecionado', async () => {
    getMock.mockResolvedValue(list(makeRequest({ status: 'Enviada' })))
    const user = userEvent.setup()
    renderWithProviders(<RequestsPage />)

    await user.click(await screen.findByRole('button', { name: 'Aprovadas: 0 solicitações' }))
    expect(screen.getByText('Nenhuma solicitação em “Aprovadas”')).toBeInTheDocument()
    expect(screen.queryByText('SOL-1042')).not.toBeInTheDocument()
  })

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
    const button = screen.queryByRole('button', { name: 'Cancelar' })
    expect(Boolean(button)).toBe(visible)
  })

  describe('cancelamento com confirmação', () => {
    const cancelButton = () => screen.getByRole('button', { name: 'Cancelar' })
    const dialog = () => screen.getByRole('dialog')

    async function openDialog(status: 'Enviada' | 'Em análise' = 'Enviada') {
      getMock.mockResolvedValue(list(makeRequest({ status })))
      renderWithProviders(<RequestsPage />)
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
      return user
    }

    it('"Cancelar" abre o modal acessível sem enviar nada', async () => {
      await openDialog()

      expect(dialog()).toHaveAttribute('aria-modal', 'true')
      expect(dialog()).toHaveAccessibleName(/cancelar a solicitação de /i)
      expect(dialog()).toHaveTextContent('Essa ação não pode ser desfeita.')
      expect(screen.getByRole('button', { name: 'Voltar' })).toHaveFocus()
      expect(postMock).not.toHaveBeenCalled()
    })

    it('"Voltar" fecha sem cancelar e devolve o foco ao botão de origem', async () => {
      const user = await openDialog()
      await user.click(screen.getByRole('button', { name: 'Voltar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(postMock).not.toHaveBeenCalled()
      expect(cancelButton()).toHaveFocus()
    })

    it('Esc fecha sem cancelar', async () => {
      const user = await openDialog()
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(postMock).not.toHaveBeenCalled()
      expect(cancelButton()).toHaveFocus()
    })

    it('clique fora fecha sem cancelar, e clique dentro não fecha', async () => {
      const user = await openDialog()
      await user.click(dialog())
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      await user.click(dialog().parentElement as HTMLElement)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(postMock).not.toHaveBeenCalled()
    })

    it('prende o foco dentro do modal com Tab e Shift+Tab', async () => {
      const user = await openDialog()
      const back = screen.getByRole('button', { name: 'Voltar' })
      const confirm = screen.getByRole('button', { name: 'Cancelar solicitação' })

      await user.tab()
      expect(confirm).toHaveFocus()
      await user.tab()
      expect(back).toHaveFocus()
      await user.tab({ shift: true })
      expect(confirm).toHaveFocus()
    })

    it('confirmar cancela com POST transitions { to: CANCELADA } e recarrega a lista', async () => {
      getMock
        .mockResolvedValueOnce(list(makeRequest({ status: 'Enviada' })))
        .mockResolvedValue(list(makeRequest({ status: 'Cancelada' })))
      postMock.mockResolvedValue(makeRequest({ status: 'Cancelada' }))
      renderWithProviders(<RequestsPage />)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar solicitação' }))

      expect(postMock).toHaveBeenCalledWith('/requests/SOL-1042/transitions', {
        to: 'CANCELADA',
      })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
      expect(screen.getByText('Cancelada')).toBeInTheDocument()
      // O botão de origem some com o status; o foco vai para o cartão da solicitação.
      expect(document.getElementById('request-SOL-1042')).toHaveFocus()
    })

    it('trava os botões e ignora Esc enquanto a requisição está em andamento', async () => {
      getMock.mockResolvedValue(list(makeRequest({ status: 'Enviada' })))
      postMock.mockReturnValue(new Promise(() => {}))
      renderWithProviders(<RequestsPage />)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar solicitação' }))

      expect(screen.getByRole('button', { name: 'Cancelar solicitação' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled()
      await user.keyboard('{Escape}')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(postMock).toHaveBeenCalledTimes(1)
    })

    it('um refetch que falha não derruba o modal aberto', async () => {
      getMock.mockResolvedValue(list(makeRequest({ status: 'Enviada' })))
      postMock.mockReturnValue(new Promise(() => {}))
      const { queryClient } = renderWithProviders(<RequestsPage />)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
      getMock.mockRejectedValue(ApiError.network())
      await act(async () => {
        await queryClient.invalidateQueries()
        // O TanStack Query notifica os componentes em um setTimeout(0).
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(queryClient.getQueryState(adoptionRequestKeys.list())?.status).toBe('error')

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(
        screen.queryByText(/não foi possível carregar suas solicitações/i),
      ).not.toBeInTheDocument()
    })

    it('limpa o erro de uma tentativa anterior ao abrir o modal de novo', async () => {
      getMock.mockResolvedValue(list(makeRequest({ status: 'Enviada' })))
      postMock.mockRejectedValue(ApiError.network())
      renderWithProviders(<RequestsPage />)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar solicitação' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('409 ao cancelar fecha o modal e mostra mensagem clara', async () => {
      getMock.mockResolvedValue(list(makeRequest({ status: 'Enviada' })))
      postMock.mockRejectedValue(new ApiError(409, 'Não é possível cancelar'))
      renderWithProviders(<RequestsPage />)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar solicitação' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/não pode mais ser cancelada/i)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('falha de rede ao cancelar fecha o modal e mostra a mensagem genérica', async () => {
      getMock.mockResolvedValue(list(makeRequest({ status: 'Enviada' })))
      postMock.mockRejectedValue(ApiError.network())
      renderWithProviders(<RequestsPage />)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar solicitação' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível cancelar a solicitação. Tente novamente.',
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
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
