import { useEffect, useMemo, useState, type UIEvent } from 'react'
import { ApiError } from '../lib/ApiError'
import {
  useMarkRequestChatRead,
  useRequestChatMessages,
  useSendRequestChatMessage,
} from '../hooks/useRequestChat'
import type { RequestChatMessage } from '../schemas/requestChatSchema'
import type { RequestStatus } from '../types'
import { Button, cx } from './ui'

const FINAL_STATUSES: readonly RequestStatus[] = ['Aprovada', 'Recusada', 'Cancelada']

function messageTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 409) {
    return 'Esta solicitação foi encerrada. O chat está disponível somente para leitura.'
  }
  return error instanceof Error ? error.message : 'Tente novamente.'
}

export function RequestChat({ requestId, status }: { requestId: string; status: RequestStatus }) {
  const query = useRequestChatMessages(requestId)
  const sendMessage = useSendRequestChatMessage(requestId)
  const markRead = useMarkRequestChatRead(requestId)
  const { mutate: markMessagesRead } = markRead
  const [draft, setDraft] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const [sentMessages, setSentMessages] = useState<RequestChatMessage[]>([])
  const [optimisticMessage, setOptimisticMessage] = useState<{
    id: string
    body: string
  } | null>(null)
  const readOnly = FINAL_STATUSES.includes(status)

  useEffect(() => {
    markMessagesRead()
  }, [markMessagesRead])

  const messages = useMemo(
    () => [...(query.data?.pages ?? [])].reverse().flatMap((page) => page.data),
    [query.data],
  )
  const visibleMessages = [
    ...messages,
    ...sentMessages.filter((sent) => !messages.some((message) => message.id === sent.id)),
  ]

  const submit = async (value: string) => {
    const body = value.trim()
    if (!body || body.length > 2000 || sendMessage.isPending || readOnly) return

    setFailedMessage('')
    setOptimisticMessage({ id: `pending-${Date.now()}`, body })
    try {
      const sent = await sendMessage.mutateAsync(body)
      setSentMessages((current) => [...current.filter(({ id }) => id !== sent.id), sent])
      setDraft('')
      setOptimisticMessage(null)
    } catch {
      setOptimisticMessage(null)
      setFailedMessage(body)
    }
  }

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop <= 16 && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage()
    }
  }

  if (query.isPending) return <p role="status">Carregando mensagens...</p>
  if (query.isError) {
    return (
      <div>
        <p role="alert">Não foi possível carregar as mensagens. {getErrorMessage(query.error)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <section aria-label={`Conversa da solicitação ${requestId}`} className="mt-4">
      {readOnly && (
        <p className="mb-3 rounded-lg bg-forest-50 p-3 text-sm text-muted" role="status">
          Esta solicitação foi encerrada. O chat está disponível somente para leitura.
        </p>
      )}
      {markRead.isError && (
        <p className="mb-3 text-sm text-[#a33f2d]" role="alert">
          Não foi possível atualizar o contador de mensagens lidas.{' '}
          {getErrorMessage(markRead.error)}
        </p>
      )}
      {query.hasNextPage && (
        <Button
          variant="text"
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Carregar mensagens anteriores
        </Button>
      )}
      <div
        className="my-3 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-line bg-forest-50/50 p-3"
        onScroll={handleScroll}
        role="log"
        aria-label="Mensagens da conversa"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {visibleMessages.length === 0 && !optimisticMessage ? (
          <p className="text-sm text-muted">Ainda não há mensagens nesta conversa.</p>
        ) : (
          visibleMessages.map((message) => (
            <article
              key={message.id}
              className={cx(
                'max-w-[90%] rounded-xl p-3 text-sm',
                message.mine ? 'ml-auto bg-forest-800 text-white' : 'bg-white text-ink',
              )}
            >
              <p className="mb-1 text-[11px] font-bold">
                {message.mine ? 'Você' : message.authorName}
              </p>
              <p className="mb-1 whitespace-pre-wrap break-words">{message.body}</p>
              <time
                className="block text-right text-[10px] opacity-75"
                dateTime={message.createdAt}
              >
                {messageTime(message.createdAt)}
              </time>
            </article>
          ))
        )}
        {optimisticMessage && (
          <article className="ml-auto max-w-[90%] rounded-xl bg-forest-800 p-3 text-sm text-white">
            <p className="mb-1 text-[11px] font-bold">Você · Enviando...</p>
            <p className="mb-0 whitespace-pre-wrap break-words">{optimisticMessage.body}</p>
          </article>
        )}
        {failedMessage && (
          <article className="ml-auto max-w-[90%] rounded-xl border border-coral bg-white p-3 text-sm">
            <p className="mb-1 whitespace-pre-wrap break-words">{failedMessage}</p>
            <p className="mb-2 text-xs text-[#a33f2d]" role="alert">
              Não foi possível enviar esta mensagem. {getErrorMessage(sendMessage.error)}
            </p>
            <Button
              variant="secondary"
              size="sm"
              loading={sendMessage.isPending}
              onClick={() => void submit(failedMessage)}
            >
              Tentar novamente
            </Button>
          </article>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit(draft)
        }}
        className="grid gap-2"
      >
        <label htmlFor={`chat-message-${requestId}`} className="text-sm font-semibold">
          Mensagem
        </label>
        <textarea
          id={`chat-message-${requestId}`}
          value={draft}
          maxLength={2000}
          rows={3}
          disabled={readOnly || sendMessage.isPending}
          aria-describedby={`chat-help-${requestId}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit(draft)
            }
          }}
          className="w-full resize-y rounded-xl border border-line bg-white p-3 text-sm disabled:bg-forest-50"
          placeholder={readOnly ? 'A conversa foi encerrada.' : 'Escreva uma mensagem...'}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <small id={`chat-help-${requestId}`} className="text-xs text-muted">
            Enter envia; Shift+Enter cria uma nova linha. {draft.length}/2000 caracteres.
          </small>
          <Button
            type="submit"
            loading={sendMessage.isPending}
            disabled={readOnly || !draft.trim() || draft.length > 2000}
          >
            Enviar mensagem
          </Button>
        </div>
      </form>
    </section>
  )
}
