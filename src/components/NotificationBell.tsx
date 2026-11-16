import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreview,
} from '../hooks/useNotifications'
import type { Notification } from '../schemas/notificationSchema'
import { getInternalNotificationPath } from '../utils/notificationLink'
import { Button, cx } from './ui'

const formatCreatedAt = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

export function NotificationBell({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const notificationsQuery = useNotificationPreview(enabled)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const notifications = notificationsQuery.data?.data ?? []
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0

  useEffect(() => {
    if (!open) return

    dropdownRef.current?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus()
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        bellRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const openNotification = (notification: Notification) => {
    const path = getInternalNotificationPath(notification.link)
    if (!path) return

    if (!notification.readAt) {
      markRead.mutate(notification.id, {
        onSuccess: () => {
          setOpen(false)
          navigate(path)
        },
      })
      return
    }

    setOpen(false)
    navigate(path)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={bellRef}
        type="button"
        className="relative grid size-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-forest-800 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-forest-700"
        aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
        aria-expanded={open}
        aria-controls="notification-dropdown"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id="notification-dropdown"
          ref={dropdownRef}
          className="absolute right-0 top-[calc(100%+10px)] z-[60] grid w-[min(90vw,390px)] gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft"
          aria-label="Notificações recentes"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="mb-0 font-sans text-base tracking-normal">Notificações</h2>
            {unreadCount > 0 && (
              <Button
                variant="text"
                className="min-h-0 px-1 py-1 text-xs"
                loading={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck size={15} /> Marcar todas como lidas
              </Button>
            )}
          </div>

          {notificationsQuery.isPending ? (
            <p className="mb-0 py-5 text-center text-sm text-muted" role="status">
              Carregando notificações...
            </p>
          ) : notificationsQuery.isError ? (
            <p className="mb-0 rounded-lg bg-coral-pale p-3 text-sm text-[#a33f2d]" role="alert">
              Não foi possível carregar as notificações. Tente novamente mais tarde.
            </p>
          ) : notifications.length === 0 ? (
            <p className="mb-0 py-5 text-center text-sm text-muted">Você está em dia!</p>
          ) : (
            <ul className="m-0 grid max-h-[min(55vh,420px)] list-none gap-1 overflow-y-auto p-0">
              {notifications.slice(0, 7).map((notification) => {
                const safePath = getInternalNotificationPath(notification.link)
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      disabled={!safePath || markRead.isPending}
                      className={cx(
                        'grid w-full cursor-pointer gap-1 rounded-xl border-0 px-3 py-3 text-left hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-60',
                        !notification.readAt && 'bg-forest-50/70',
                      )}
                      onClick={() => openNotification(notification)}
                    >
                      <span className="flex w-full items-start justify-between gap-2 text-sm font-bold text-ink">
                        {notification.title}
                        {!notification.readAt && (
                          <span
                            className="mt-1 size-2 shrink-0 rounded-full bg-coral"
                            aria-label="Não lida"
                          />
                        )}
                      </span>
                      <span className="line-clamp-2 text-xs leading-5 text-muted">
                        {notification.body}
                      </span>
                      <time className="text-[10px] text-muted" dateTime={notification.createdAt}>
                        {formatCreatedAt(notification.createdAt)}
                      </time>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {(markRead.isError || markAllRead.isError) && (
            <p className="mb-0 text-xs text-[#a33f2d]" role="alert">
              Não foi possível atualizar o estado da notificação. Tente novamente.
            </p>
          )}

          <div className="flex justify-between border-t border-line pt-3 text-xs font-bold">
            <Link
              to="/notificacoes"
              className="inline-flex items-center gap-1 text-forest-800"
              onClick={() => setOpen(false)}
            >
              Ver todas <ChevronRight size={15} />
            </Link>
            <Link
              to="/notificacoes/preferencias"
              className="text-forest-800"
              onClick={() => setOpen(false)}
            >
              Preferências
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
