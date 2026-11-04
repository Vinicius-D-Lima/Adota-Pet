import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { renderWithProviders } from '../test/renderWithProviders'
import { RequestChat } from './RequestChat'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const patchMock = vi.mocked(api.patch)

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'MSG-1',
  authorName: 'Instituto Patinhas',
  mine: false,
  body: 'Olá! Como está sua rotina?',
  createdAt: '2026-10-25T13:00:00.000Z',
  readAt: null,
  ...overrides,
})

const makePage = (overrides: Record<string, unknown> = {}) => ({
  data: [makeMessage()],
  unreadCount: 1,
  nextCursor: null,
  ...overrides,
})

function setup(status: 'Em análise' | 'Aprovada' | 'Recusada' | 'Cancelada' = 'Em análise') {
  return renderWithProviders(<RequestChat requestId="SOL-1042" status={status} />)
}

beforeEach(() => {
  getMock.mockReset().mockResolvedValue(makePage())
  postMock.mockReset()
  patchMock.mockReset().mockResolvedValue(undefined)
})

describe('RequestChat', () => {
  it('renderiza conteúdo recebido como texto puro e marca as mensagens como lidas ao abrir', async () => {
    getMock.mockResolvedValue(
      makePage({ data: [makeMessage({ body: '<script>alert(1)</script>' })] }),
    )
    setup()

    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).not.toBeInTheDocument()
    expect(patchMock).toHaveBeenCalledWith('/requests/SOL-1042/messages/read')
  })

  it('envia com Enter, mantém Shift+Enter como quebra de linha e mostra o limite', async () => {
    const user = userEvent.setup({ delay: null })
    postMock.mockResolvedValue(
      makeMessage({
        id: 'MSG-2',
        mine: true,
        body: 'Oi!',
        createdAt: '2026-10-25T13:05:00.000Z',
      }),
    )
    setup()
    const input = await screen.findByRole('textbox', { name: 'Mensagem' })

    await user.type(input, 'Oi!{shift>}{enter}{/shift}')
    expect(postMock).not.toHaveBeenCalled()
    expect(input).toHaveValue('Oi!\n')
    await user.clear(input)
    await user.type(input, 'Oi!{enter}')

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/requests/SOL-1042/messages', { body: 'Oi!' }),
    )
    expect(await screen.findByText('Você')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(screen.getByText(/0\s*\/2000 caracteres\./)).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'x'.repeat(2001) } })
    expect(input).toHaveAttribute('maxLength', '2000')
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled()
  })

  it('mostra falha de envio e permite tentar novamente', async () => {
    const user = userEvent.setup()
    postMock
      .mockRejectedValueOnce(new ApiError(0, 'Servidor indisponível'))
      .mockResolvedValueOnce(
        makeMessage({ id: 'MSG-2', mine: true, body: 'Mensagem para reenviar' }),
      )
    setup()
    const input = await screen.findByRole('textbox', { name: 'Mensagem' })
    await user.type(input, 'Mensagem para reenviar{enter}')

    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível enviar esta mensagem.')
    await user.click(retry)

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Mensagem para reenviar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('carrega mensagens antigas ao rolar até o início do histórico', async () => {
    getMock
      .mockResolvedValueOnce(makePage({ data: [makeMessage()], nextCursor: 'MSG-1' }))
      .mockResolvedValueOnce(
        makePage({ data: [makeMessage({ id: 'MSG-0', body: 'Mensagem antiga' })] }),
      )
    setup()
    await screen.findByText('Olá! Como está sua rotina?')

    const log = screen.getByRole('log', { name: 'Mensagens da conversa' })
    fireEvent.scroll(log, { target: { scrollTop: 0 } })

    expect(await screen.findByText('Mensagem antiga')).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith(
      '/requests/SOL-1042/messages',
      expect.objectContaining({ query: { cursor: 'MSG-1' } }),
    )
  })

  it.each(['Aprovada', 'Recusada', 'Cancelada'] as const)(
    'mantém o chat somente leitura quando a solicitação está %s',
    async (status) => {
      setup(status)
      expect(
        await screen.findByText(
          'Esta solicitação foi encerrada. O chat está disponível somente para leitura.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Mensagem' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled()
    },
  )
})
