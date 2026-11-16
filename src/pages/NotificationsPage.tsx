import { Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationHistory,
} from '../hooks/useNotifications'
import { useDemoAccount } from '../hooks/useDemoAccount'
import type { Notification } from '../schemas/notificationSchema'
import { getInternalNotificationPath } from '../utils/notificationLink'
import { Button, Container, EmptyState, PageIntro, PageSurface, cx } from '../components/ui'

const formatCreatedAt = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

export function NotificationsPage() {
  const account = useDemoAccount()
  const navigate = useNavigate()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const historyQuery = useNotificationHistory(account.isAuthenticated, unreadOnly)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const pages = historyQuery.data?.pages ?? []
  const notifications = pages.flatMap((page) => page.data)
  const unreadCount = pages[0]?.unreadCount ?? 0

  const openNotification = (notification: Notification) => {
    const path = getInternalNotificationPath(notification.link)
    if (!path) return
    if (!notification.readAt) {
      markRead.mutate(notification.id, { onSuccess: () => navigate(path) })
      return
    }
    navigate(path)
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-16 pt-10 md:pb-24 md:pt-14">
        <PageIntro
          eyebrow="Sua conta"
          title="Notificações"
          description="Acompanhe atualizações sobre solicitações, conversas e seus pets."
        />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-forest-800">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />
            Mostrar somente não lidas
          </label>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck size={17} /> Marcar todas como lidas
            </Button>
          )}
        </div>

        {(markRead.isError || markAllRead.isError) && (
          <p className="mb-4 rounded-lg bg-coral-pale p-3 text-sm text-[#a33f2d]" role="alert">
            Não foi possível atualizar as notificações. Tente novamente.
          </p>
        )}

        {historyQuery.isPending ? (
          <p className="py-12 text-center text-sm text-muted" role="status">
            Carregando notificações...
          </p>
        ) : historyQuery.isError ? (
          <EmptyState
            icon={<Bell size={32} />}
            title="Não foi possível carregar as notificações"
            description="Verifique sua conexão e tente novamente."
            role="alert"
          >
            <Button onClick={() => void historyQuery.refetch()}>
              <RefreshCw size={16} /> Tentar novamente
            </Button>
          </EmptyState>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={32} />}
            title="Você está em dia!"
            description={
              unreadOnly
                ? 'Não há notificações não lidas.'
                : 'Quando houver novidades sobre sua conta, elas aparecerão aqui.'
            }
          />
        ) : (
          <div className="grid gap-3">
            {notifications.map((notification) => {
              const safePath = getInternalNotificationPath(notification.link)
              return (
                <article
                  key={notification.id}
                  className={cx(
                    'rounded-2xl border border-line bg-white p-4 shadow-[0_6px_20px_rgba(30,60,48,0.04)] md:p-5',
                    !notification.readAt && 'border-l-4 border-l-coral',
                  )}
                >
                  <button
                    type="button"
                    className="grid w-full cursor-pointer gap-2 border-0 bg-transparent p-0 text-left disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!safePath || markRead.isPending}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="flex items-start justify-between gap-4 text-sm font-bold text-ink">
                      {notification.title}
                      {!notification.readAt && (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-coral">
                          <span className="sr-only">Não lida</span>
                        </span>
                      )}
                    </span>
                    <span className="text-sm leading-6 text-muted">{notification.body}</span>
                    <time className="text-xs text-muted" dateTime={notification.createdAt}>
                      {formatCreatedAt(notification.createdAt)}
                    </time>
                  </button>
                </article>
              )
            })}
            {historyQuery.hasNextPage && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="secondary"
                  loading={historyQuery.isFetchingNextPage}
                  onClick={() => void historyQuery.fetchNextPage()}
                >
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        )}
      </Container>
    </PageSurface>
  )
}
