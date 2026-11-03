import { useState } from 'react'
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from '../hooks/useNotifications'
import { useDemoAccount } from '../hooks/useDemoAccount'
import {
  notificationTypes,
  notificationTypeLabels,
  type NotificationPreference,
} from '../schemas/notificationSchema'
import { Alert, Button, Container, EmptyState, PageIntro, PageSurface } from '../components/ui'

function hasEveryPreference(preferences: NotificationPreference[]) {
  return notificationTypes.every((type) =>
    preferences.some((preference) => preference.type === type),
  )
}

export function NotificationPreferencesPage() {
  const account = useDemoAccount()
  const preferencesQuery = useNotificationPreferences(account.isAuthenticated)
  const saveMutation = useSaveNotificationPreferences()
  const [saved, setSaved] = useState(false)
  const preferences = preferencesQuery.data ?? []

  const save = (
    type: NotificationPreference['type'],
    channel: 'inApp' | 'email',
    value: boolean,
  ) => {
    const next = preferences.map((preference) =>
      preference.type === type ? { ...preference, [channel]: value } : preference,
    )
    setSaved(false)
    saveMutation.mutate(next, { onSuccess: () => setSaved(true) })
  }

  if (preferencesQuery.isPending) {
    return (
      <PageSurface>
        <Container as="section" className="py-12">
          <p className="text-center text-sm text-muted" role="status">
            Carregando preferências...
          </p>
        </Container>
      </PageSurface>
    )
  }

  if (preferencesQuery.isError || !hasEveryPreference(preferences)) {
    return (
      <PageSurface>
        <Container as="section" className="py-12">
          <EmptyState
            title="Não foi possível carregar as preferências"
            description="A API precisa retornar as preferências de todos os tipos de notificação. Tente novamente mais tarde."
            role="alert"
          >
            <Button onClick={() => void preferencesQuery.refetch()}>Tentar novamente</Button>
          </EmptyState>
        </Container>
      </PageSurface>
    )
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-16 pt-10 md:pb-24 md:pt-14">
        <PageIntro
          eyebrow="Sua conta"
          title="Preferências de notificação"
          description="Escolha quais atualizações quer receber no aplicativo e por e-mail."
        />
        {saveMutation.isError && (
          <Alert role="alert" className="mb-4">
            Não foi possível salvar a preferência. Verifique sua conexão e tente novamente.
          </Alert>
        )}
        {saved && (
          <p className="mb-4 rounded-lg bg-forest-50 p-3 text-sm text-forest-800" role="status">
            Preferência salva.
          </p>
        )}
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-forest-50 text-forest-800">
                <th scope="col" className="p-4 font-bold">
                  Tipo de atualização
                </th>
                <th scope="col" className="p-4 text-center font-bold">
                  Aplicativo
                </th>
                <th scope="col" className="p-4 text-center font-bold">
                  E-mail
                </th>
              </tr>
            </thead>
            <tbody>
              {notificationTypes.map((type) => {
                const preference = preferences.find((item) => item.type === type)
                if (!preference) return null
                return (
                  <tr key={type} className="border-b border-line last:border-0">
                    <th scope="row" className="p-4 font-semibold text-ink">
                      {notificationTypeLabels[type]}
                    </th>
                    {(['inApp', 'email'] as const).map((channel) => (
                      <td key={channel} className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={preference[channel]}
                          disabled={saveMutation.isPending}
                          aria-label={`${notificationTypeLabels[type]} — ${channel === 'inApp' ? 'aplicativo' : 'e-mail'}`}
                          onChange={(event) => save(type, channel, event.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted" aria-live="polite">
          {saveMutation.isPending ? 'Salvando preferência...' : ''}
        </p>
      </Container>
    </PageSurface>
  )
}
