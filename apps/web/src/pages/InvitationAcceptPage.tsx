import { CheckCircle2, MailWarning } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  EmptyState,
  Feedback,
  PageIntro,
  PageSurface,
} from '../components/ui'
import { useAcceptInvitation, useInvitationPreview } from '../hooks/useOrganization'
import { ApiError } from '../lib/ApiError'

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof ApiError ? cause.message : fallback

export function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const previewQuery = useInvitationPreview(token)
  const accept = useAcceptInvitation()

  if (previewQuery.isPending) return <Feedback>Verificando convite...</Feedback>

  if (previewQuery.isError) {
    const apiError =
      previewQuery.error instanceof ApiError ? previewQuery.error : ApiError.network()
    const friendly = [400, 403, 404, 410].includes(apiError.statusCode)
    return (
      <PageSurface>
        <Container as="section" className="py-16">
          <EmptyState
            headingAs="h1"
            role="alert"
            icon={<MailWarning size={30} />}
            title="Este convite não está disponível"
            description={
              friendly
                ? apiError.message
                : 'Não foi possível verificar o convite no momento. Tente novamente mais tarde.'
            }
          >
            <Button variant="secondary" onClick={() => void previewQuery.refetch()}>
              Tentar novamente
            </Button>
            <Link className="ml-2 text-sm font-bold text-forest-700" to="/">
              Voltar ao início
            </Link>
          </EmptyState>
        </Container>
      </PageSurface>
    )
  }

  const preview = previewQuery.data
  const organizationName =
    preview?.organization?.name ?? preview?.organizationName ?? 'uma organização'
  const roleLabel = preview?.role === 'ADMIN' ? 'Administrador' : 'Voluntário'

  if (accept.isSuccess) {
    return (
      <PageSurface>
        <Container as="section" className="py-16">
          <EmptyState
            headingAs="h1"
            icon={<CheckCircle2 size={32} />}
            title="Convite aceito!"
            description={`Você agora faz parte de ${organizationName}.`}
          >
            <Link
              className="rounded-xl bg-coral px-4 py-2.5 text-sm font-bold text-white"
              to="/organizacao"
            >
              Ir para a área da organização
            </Link>
          </EmptyState>
        </Container>
      </PageSurface>
    )
  }

  return (
    <PageSurface>
      <Container as="section" className="mx-auto max-w-[640px] py-16">
        <PageIntro
          eyebrow="Convite de organização"
          title="Você foi convidado"
          description="Confira os dados abaixo antes de aceitar."
        />
        <Card className="p-6 md:p-8">
          <p className="m-0 text-xs font-bold uppercase tracking-[.12em] text-coral">Organização</p>
          <h2 className="mb-4 mt-1 text-2xl">{organizationName}</h2>
          <div className="grid gap-4">
            <div>
              <small className="block text-xs text-muted">Papel</small>
              <Badge tone={preview?.role === 'ADMIN' ? 'approved' : 'review'}>{roleLabel}</Badge>
            </div>
            {preview?.email && (
              <div>
                <small className="block text-xs text-muted">Convite enviado para</small>
                <strong className="text-sm">{preview.email}</strong>
              </div>
            )}
            {preview?.expiresAt && (
              <div>
                <small className="block text-xs text-muted">Validade</small>
                <strong className="text-sm">
                  {new Date(preview.expiresAt).toLocaleDateString('pt-BR')}
                </strong>
              </div>
            )}
          </div>
          <Button
            className="mt-7"
            loading={accept.isPending}
            disabled={!token}
            onClick={() => {
              if (token) accept.mutate(token)
            }}
          >
            Aceitar
          </Button>
          {accept.isError && (
            <Alert>{messageOf(accept.error, 'Não foi possível aceitar o convite.')}</Alert>
          )}
        </Card>
      </Container>
    </PageSurface>
  )
}
