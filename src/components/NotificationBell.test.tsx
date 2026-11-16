import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notification } from '../schemas/notificationSchema'
import { renderWithProviders } from '../test/renderWithProviders'
import { NotificationBell } from './NotificationBell'

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

const originalNotification: Notification = {
  id: 'notice-1',
  type: 'RequestStatusChanged',
  title: 'Sua solicitação foi atualizada',
  body: 'A organização analisou sua solicitação.',
  link: '/solicitacoes/request-1',
  readAt: null,
  createdAt: '2026-10-25T12:00:00.000Z',
}

let notifications: Notification[]

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function setup() {
  renderWithProviders(
    <>
      <NotificationBell enabled />
      <LocationProbe />
    </>,
  )
}

beforeEach(() => {
  notifications = [{ ...originalNotification }]
  mocks.get.mockReset().mockImplementation((path: string) => {
    if (path === '/me/notifications') {
      return Promise.resolve({
        data: notifications,
        unreadCount: notifications.filter((notification) => !notification.readAt).length,
      })
    }
    return Promise.reject(new Error(`Endpoint inesperado: ${path}`))
  })
  mocks.patch.mockReset().mockImplementation((path: string) => {
    if (path.endsWith('/read-all')) {
      notifications = notifications.map((notification) => ({
        ...notification,
        readAt: '2026-10-25T12:01:00.000Z',
      }))
      return Promise.resolve()
    }
    const id = path.split('/').slice(-2)[0]
    notifications = notifications.map((notification) =>
      notification.id === id
        ? { ...notification, readAt: '2026-10-25T12:01:00.000Z' }
        : notification,
    )
    return Promise.resolve()
  })
})

describe('NotificationBell', () => {
  it('mostra o total de não lidas e marca uma como lida antes de navegar', async () => {
    const user = userEvent.setup()
    setup()

    const bell = await screen.findByRole('button', { name: 'Notificações, 1 não lidas' })
    await user.click(bell)
    await user.click(await screen.findByRole('button', { name: /Sua solicitação foi atualizada/ }))

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/me/notifications/notice-1/read'))
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/solicitacoes/request-1'),
    )
  })

  it('marca todas como lidas e remove o badge após resposta da API', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(await screen.findByRole('button', { name: 'Notificações, 1 não lidas' }))
    await user.click(await screen.findByRole('button', { name: /Marcar todas como lidas/ }))

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/me/notifications/read-all'))
    expect(await screen.findByRole('button', { name: 'Notificações' })).toBeInTheDocument()
  })

  it('fecha com Escape e devolve o foco ao botão do sino', async () => {
    const user = userEvent.setup()
    setup()

    const bell = await screen.findByRole('button', { name: 'Notificações, 1 não lidas' })
    await user.click(bell)
    expect(screen.getByRole('region', { name: 'Notificações recentes' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('region', { name: 'Notificações recentes' })).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('não permite navegar para links externos em notificações', async () => {
    const user = userEvent.setup()
    notifications = [{ ...originalNotification, link: 'https://example.com' }]
    setup()

    await user.click(await screen.findByRole('button', { name: 'Notificações, 1 não lidas' }))
    expect(
      await screen.findByRole('button', { name: /Sua solicitação foi atualizada/ }),
    ).toBeDisabled()
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('mostra o estado vazio quando não há notificações', async () => {
    notifications = []
    setup()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Notificações' }))

    expect(await screen.findByText('Você está em dia!')).toBeInTheDocument()
  })
})
