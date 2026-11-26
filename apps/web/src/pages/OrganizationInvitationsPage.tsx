import { zodResolver } from '@hookform/resolvers/zod'
import { organizationInvitationCreateSchema } from '@adotapet/shared'
import { Copy, Mail, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import {
  BackLink,
  Alert,
  Button,
  Card,
  Container,
  Field,
  Feedback,
  Input,
  PageIntro,
  PageSurface,
  Select,
} from '../components/ui'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  useActiveOrganizationId,
  useCreateOrganizationInvitation,
  useOrganizationInvitations,
  useRevokeOrganizationInvitation,
  type OrganizationInvitation,
} from '../hooks/useOrganization'
import { ApiError } from '../lib/ApiError'

type InvitationForm = { email: string; role: 'ADMIN' | 'VOLUNTEER' }

const tokenFromUrl = (url: string) =>
  /\/invitations\/([^/?]+)\/accept/.exec(url)?.[1] ?? /\/convite\/([^/?]+)/.exec(url)?.[1] ?? ''

function invitationUrl(invitation: OrganizationInvitation) {
  const token = invitation.token ?? tokenFromUrl(invitation.acceptUrl ?? '')
  return token ? `${window.location.origin}/convite/${token}` : ''
}

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export function OrganizationInvitationsPage() {
  const organizationId = useActiveOrganizationId()
  const invitationsQuery = useOrganizationInvitations(organizationId)
  const createInvitation = useCreateOrganizationInvitation(organizationId)
  const revokeInvitation = useRevokeOrganizationInvitation(organizationId)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [pendingRevocation, setPendingRevocation] = useState<OrganizationInvitation | null>(null)
  const [recentInvitation, setRecentInvitation] = useState<OrganizationInvitation | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvitationForm>({
    resolver: zodResolver(organizationInvitationCreateSchema) as Resolver<InvitationForm>,
    defaultValues: { email: '', role: 'VOLUNTEER' },
  })

  if (invitationsQuery.isPending) return <Feedback>Carregando convites...</Feedback>
  if (invitationsQuery.isError) {
    return <Feedback error>Não foi possível carregar os convites.</Feedback>
  }

  const pending = invitationsQuery.data.filter(({ status }) => status === 'PENDENTE')

  const submit = handleSubmit(async (data) => {
    setError('')
    try {
      const created = await createInvitation.mutateAsync({ email: data.email, role: data.role })
      setRecentInvitation(created)
      reset({ email: '', role: 'VOLUNTEER' })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível enviar o convite.')
    }
  })

  const copyLink = async (invitation: OrganizationInvitation) => {
    const url = invitationUrl(invitation)
    if (!url) {
      setError('O link deste convite não está mais disponível. Crie um novo convite para copiar.')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(invitation.id)
      setError('')
    } catch {
      setError('Não foi possível copiar o link. Copie manualmente pelo endereço da página.')
    }
  }

  const confirmRevocation = async () => {
    if (!pendingRevocation) return
    setError('')
    try {
      await revokeInvitation.mutateAsync(pendingRevocation.id)
      setPendingRevocation(null)
      if (recentInvitation?.id === pendingRevocation.id) setRecentInvitation(null)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível revogar o convite.')
    }
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <BackLink to="/organizacao/membros">Voltar para membros</BackLink>
        <PageIntro
          eyebrow="Área da organização"
          title="Convites"
          description="Convide pessoas por e-mail, acompanhe os pendentes e compartilhe o link de aceite."
        />

        <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
          <Card className="h-fit p-5 md:p-7">
            <h2 className="mb-4 mt-0 text-2xl">Novo convite</h2>
            <form className="grid" onSubmit={(event) => void submit(event)} noValidate>
              <Field label="E-mail" error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="pessoa@email.com"
                  invalid={Boolean(errors.email)}
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </Field>
              <Field label="Papel" error={errors.role?.message}>
                <Select invalid={Boolean(errors.role)} {...register('role')}>
                  <option value="VOLUNTEER">Voluntário</option>
                  <option value="ADMIN">Administrador</option>
                </Select>
              </Field>
              <Button type="submit" loading={createInvitation.isPending}>
                <Send size={17} /> Enviar convite
              </Button>
              {error && <Alert>{error}</Alert>}
              {recentInvitation && (
                <div className="mt-4 rounded-xl bg-forest-50 p-4">
                  <p className="m-0 text-xs font-bold text-forest-800">Convite criado</p>
                  <p className="mb-3 mt-1 break-all text-[11px] text-muted">
                    {invitationUrl(recentInvitation) || recentInvitation.email}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => void copyLink(recentInvitation)}
                    disabled={!invitationUrl(recentInvitation)}
                  >
                    <Copy size={16} /> Copiar link
                  </Button>
                </div>
              )}
            </form>
          </Card>

          <Card className="p-0">
            <div className="border-b border-line px-5 py-5">
              <h2 className="m-0 text-2xl">Convites pendentes</h2>
              <p className="mb-0 mt-1 text-xs text-muted">
                {pending.length} {pending.length === 1 ? 'convite' : 'convites'} aguardando resposta
              </p>
            </div>
            {pending.length === 0 ? (
              <p className="m-0 p-6 text-sm text-muted">Nenhum convite pendente.</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {pending.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div className="min-w-0">
                      <strong className="flex items-center gap-2 text-sm">
                        <Mail size={15} /> {invitation.email}
                      </strong>
                      <small className="text-muted">
                        {invitation.role === 'ADMIN' ? 'Administrador' : 'Voluntário'} · expira em{' '}
                        {dateLabel(invitation.expiresAt)}
                      </small>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => void copyLink(invitation)}
                        disabled={!invitationUrl(invitation)}
                      >
                        <Copy size={15} /> {copiedId === invitation.id ? 'Copiado' : 'Copiar link'}
                      </Button>
                      <Button
                        variant="text"
                        onClick={() => setPendingRevocation(invitation)}
                        disabled={revokeInvitation.isPending}
                      >
                        <Trash2 size={15} /> Revogar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Container>

      {pendingRevocation && (
        <ConfirmDialog
          title="Revogar convite?"
          description={`O convite enviado para ${pendingRevocation.email} deixará de ser válido.`}
          confirmLabel="Revogar convite"
          busy={revokeInvitation.isPending}
          onConfirm={() => void confirmRevocation()}
          onClose={() => {
            setPendingRevocation(null)
            setError('')
          }}
        >
          {error && <Alert>{error}</Alert>}
        </ConfirmDialog>
      )}
    </PageSurface>
  )
}
