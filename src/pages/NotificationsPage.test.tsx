import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notificationTypes } from '../schemas/notificationSchema'
import { renderWithProviders } from '../test/renderWithProviders'
import { NotificationPreferencesPage } from './NotificationPreferencesPage'
import { NotificationsPage } from './NotificationsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), put: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

const notification = {
  id: 'notice-1',
  type: 'MessageReceived',
  title: 'Nova mensagem',
  body: '<script>alert(1)</script> apareceu como texto.',
  link: '/solicitacoes/request-1',
  readAt: null,
  createdAt: '2026-10-25T12:00:00.000Z',
}

const preferences = notificationTypes.map((type) => ({
  type,
  inApp: true,
  email: false,
}))

beforeEach(() => {
  mocks.get.mockReset().mockImplementation((path: string) => {
    if (path === '/me/notifications') {
      return Promise.resolve({ data: [notification], unreadCount: 1 })
    }
    if (path === '/me/notification-preferences') return Promise.resolve({ data: preferences })
    return Promise.reject(new Error(`Endpoint inesperado: ${path}`))
  })
  mocks.patch.mockReset().mockResolvedValue(undefined)
  mocks.put.mockReset().mockResolvedValue(undefined)
})

describe('NotificationsPage', () => {
  it('mostra o histórico como texto simples e filtra não lidas', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationsPage />, { route: '/notificacoes' })

    expect(await screen.findByText('Nova mensagem')).toBeInTheDocument()
    expect(screen.getByText('<script>alert(1)</script> apareceu como texto.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Mostrar somente não lidas' }))
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        '/me/notifications',
        expect.objectContaining({ query: { cursor: undefined, unread: true } }),
      ),
    )
  })

  it('mostra erros de carregamento em vez de um estado vazio falso', async () => {
    mocks.get.mockRejectedValue(new Error('API indisponível'))
    renderWithProviders(<NotificationsPage />, { route: '/notificacoes' })

    expect(
      await screen.findByRole('heading', { name: 'Não foi possível carregar as notificações' }),
    ).toBeInTheDocument()
  })
})

describe('NotificationPreferencesPage', () => {
  it('salva imediatamente a preferência e mostra confirmação', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationPreferencesPage />, {
      route: '/notificacoes/preferencias',
    })

    const emailCheckbox = await screen.findByRole('checkbox', {
      name: 'Mensagens de chat — e-mail',
    })
    await user.click(emailCheckbox)

    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith(
        '/me/notification-preferences',
        expect.objectContaining({
          data: expect.arrayContaining([{ type: 'MessageReceived', inApp: true, email: true }]),
        }),
      ),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Preferência salva.')
  })

  it('informa falha ao salvar sem aparentar sucesso', async () => {
    mocks.put.mockRejectedValue(new Error('API indisponível'))
    const user = userEvent.setup()
    renderWithProviders(<NotificationPreferencesPage />, {
      route: '/notificacoes/preferencias',
    })

    await user.click(await screen.findByRole('checkbox', { name: 'Mensagens de chat — e-mail' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar a preferência.',
    )
    expect(screen.queryByText('Preferência salva.')).not.toBeInTheDocument()
  })
})
