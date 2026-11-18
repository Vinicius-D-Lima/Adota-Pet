import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import {
  adminPermissions,
  completedInterview,
  makeReceivedRequest,
  scheduledInterview,
  volunteerPermissions,
} from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { OrganizationRequestDetailPage } from './OrganizationRequestDetailPage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)

const emptyChat = { data: [], unreadCount: 0, nextCursor: null }

function renderDetail(request: ReturnType<typeof makeReceivedRequest>) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/organizacao/solicitacoes/:requestId"
        element={<OrganizationRequestDetailPage />}
      />
      <Route path="/organizacao/solicitacoes" element={<p>Tela de lista</p>} />
      <Route path="/" element={<p>Tela inicial</p>} />
    </Routes>,
    { route: `/organizacao/solicitacoes/${request.id}` },
  )
}

function renderPage(
  request: ReturnType<typeof makeReceivedRequest>,
  permissions = adminPermissions,
) {
  getMock.mockImplementation(async (path) => {
    const url = String(path)
    if (url === '/me/permissions') return permissions
    if (url.endsWith('/messages')) return emptyChat
    return request
  })
  return renderDetail(request)
}

afterEach(() => vi.clearAllMocks())

describe('OrganizationRequestDetailPage', () => {
  it('esconde "Aprovar adoção" para voluntário, mesmo com a entrevista realizada', async () => {
    renderPage(makeReceivedRequest({ interview: completedInterview }), volunteerPermissions)

    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar adoção' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como realizado' })).not.toBeInTheDocument()
  })

  it('mostra "Aprovar adoção" para admin, desabilitado com explicação até a entrevista ser realizada', async () => {
    const { unmount } = renderPage(makeReceivedRequest({ interview: scheduledInterview }))

    const approve = await screen.findByRole('button', { name: 'Aprovar adoção' })
    expect(approve).toBeDisabled()
    expect(
      screen.getByText('Marque a entrevista como realizada para liberar a aprovação.'),
    ).toBeInTheDocument()
    unmount()

    renderPage(makeReceivedRequest({ interview: completedInterview }))
    expect(await screen.findByRole('button', { name: 'Aprovar adoção' })).toBeEnabled()
    expect(
      screen.queryByText('Marque a entrevista como realizada para liberar a aprovação.'),
    ).not.toBeInTheDocument()
  })

  it('desabilita "Aprovar adoção" quando nenhuma entrevista foi proposta', async () => {
    renderPage(makeReceivedRequest({ interview: null }))
    expect(await screen.findByRole('button', { name: 'Aprovar adoção' })).toBeDisabled()
  })

  it('exige motivo com pelo menos 10 caracteres e atualiza a tela sem recarregar', async () => {
    let current = makeReceivedRequest({ interview: completedInterview })
    const detailPath = `/me/received-requests/${current.id}`
    getMock.mockImplementation(async (path) => {
      const url = String(path)
      if (url === '/me/permissions') return adminPermissions
      if (url.endsWith('/messages')) return emptyChat
      return current
    })
    postMock.mockImplementation(async (path, body) => {
      if (String(path) === `${detailPath}/transitions`) {
        const payload = body as { reason: string }
        current = {
          ...current,
          status: 'Recusada',
          rejectionReason: payload.reason,
        }
        return current
      }
      throw new Error(`POST inesperado: ${path}`)
    })

    const user = userEvent.setup()
    renderDetail(current)
    await screen.findByRole('heading', { name: 'Luna' })

    await user.click(screen.getByRole('button', { name: 'Recusar' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Recusar solicitação' })
    const reason = within(dialog).getByLabelText(/Motivo da recusa/)

    expect(confirm).toBeDisabled()
    await user.type(reason, 'curto')
    expect(confirm).toBeDisabled()
    expect(postMock).not.toHaveBeenCalled()

    await user.clear(reason)
    await user.type(reason, 'A rotina informada não combina com o pet.')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(`${detailPath}/transitions`, {
        to: 'RECUSADA',
        reason: 'A rotina informada não combina com o pet.',
      }),
    )
    expect(await screen.findByText('Solicitação recusada.')).toBeInTheDocument()
    expect(
      screen.getByText(/Solicitação recusada: A rotina informada não combina com o pet\./),
    ).toBeInTheDocument()
    expect(
      getMock.mock.calls.filter(([path]) => String(path) === detailPath).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('bloqueia horário no passado no formulário e envia um horário futuro', async () => {
    const request = makeReceivedRequest({ status: 'Em análise', interview: null })
    getMock.mockImplementation(async (path) => {
      const url = String(path)
      if (url === '/me/permissions') return adminPermissions
      if (url.endsWith('/messages')) return emptyChat
      return request
    })
    postMock.mockImplementation(async (_path, body) => {
      const input = body as { type: typeof scheduledInterview.type; proposedSlots: string[] }
      return {
        ...request,
        interview: {
          ...scheduledInterview,
          type: input.type,
          proposedSlots: input.proposedSlots,
        },
      }
    })

    const user = userEvent.setup()
    renderDetail(request)
    const input = await screen.findByLabelText('Horário 1')

    fireEvent.change(input, { target: { value: '2020-01-01T10:00' } })
    expect(await screen.findByText('Escolha um horário no futuro.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Propor horários' }))
    expect(postMock).not.toHaveBeenCalled()

    const future = '2099-01-01T10:00'
    fireEvent.change(input, { target: { value: future } })
    await user.click(screen.getByRole('button', { name: 'Propor horários' }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(`/me/received-requests/${request.id}/interview`, {
        type: 'Entrevista online',
        proposedSlots: [new Date(future).toISOString()],
      }),
    )
    expect(
      await screen.findByText('Horários propostos. A pessoa adotante será avisada.'),
    ).toBeInTheDocument()
  })

  it('avança para a entrevista e mostra o novo estado sem recarregar', async () => {
    let current = makeReceivedRequest({ status: 'Enviada', interview: null })
    const detailPath = `/me/received-requests/${current.id}`
    getMock.mockImplementation(async (path) => {
      const url = String(path)
      if (url === '/me/permissions') return adminPermissions
      if (url.endsWith('/messages')) return emptyChat
      return current
    })
    postMock.mockImplementation(async (path, body) => {
      if (String(path) === `${detailPath}/transitions`) {
        expect(body).toEqual({ to: 'EM_ANALISE' })
        current = { ...current, status: 'Em análise' }
        return current
      }
      throw new Error(`POST inesperado: ${path}`)
    })

    const user = userEvent.setup()
    renderDetail(current)
    await user.click(await screen.findByRole('button', { name: 'Avançar para entrevista' }))

    expect(await screen.findByText('Solicitação avançada para a entrevista.')).toBeInTheDocument()
    expect(await screen.findByText('Propor horários de entrevista ou visita')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Avançar para entrevista' }),
    ).not.toBeInTheDocument()
  })
})
