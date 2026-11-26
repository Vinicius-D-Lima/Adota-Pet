import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useDemoAccount } from '../hooks/useDemoAccount'
import { useSelectedOrganizationId } from '../hooks/useOrganizations'
import { ApiError } from '../lib/ApiError'
import { canDo, usePermissions } from '../lib/permissions'
import { Button, Feedback } from './ui'

interface OrganizacaoGuardProps {
  children: ReactNode
  /** Quando informado, exige também esta regra (`do`) antes de liberar a rota. */
  permission?: string
  /** Assunto da regra (`on`), usado junto com `permission`. */
  subject?: string
  redirectTo?: string
}

/**
 * Protege a área da organização.
 *
 * - Sem sessão: manda para o login, guardando o destino.
 * - Conta sem organização (403 da API): volta para a home.
 * - Rotas restritas: voluntário volta ao painel, mesmo ao abrir a URL direto.
 * - Falha de rede: mostra erro com "Tentar novamente" em vez de expulsar a pessoa.
 */
export function OrganizacaoGuard({
  children,
  permission,
  subject,
  redirectTo = '/organizacao',
}: OrganizacaoGuardProps) {
  const account = useDemoAccount()
  const location = useLocation()
  const selectedOrganizationId = useSelectedOrganizationId()
  const permissions = usePermissions({
    enabled: account.isAuthenticated,
    organizationId: selectedOrganizationId,
  })

  if (account.status === 'loading') {
    return <Feedback>Verificando sua sessão...</Feedback>
  }

  if (!account.isAuthenticated) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }

  if (permissions.isPending) {
    return <Feedback>Verificando permissões da organização...</Feedback>
  }

  if (permissions.isError) {
    const forbidden =
      permissions.error instanceof ApiError &&
      (permissions.error.statusCode === 403 || permissions.error.statusCode === 404)

    if (forbidden) return <Navigate to="/" replace />

    return (
      <Feedback error>
        <div>
          <p>Não foi possível verificar suas permissões.</p>
          <Button variant="secondary" onClick={() => void permissions.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </Feedback>
    )
  }

  if (!permissions.data?.organization) return <Navigate to="/" replace />

  if (permission && subject && !canDo(permissions.data, permission, subject)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
