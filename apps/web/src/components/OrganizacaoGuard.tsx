import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useDemoAccount } from '../hooks/useDemoAccount'
import { ApiError } from '../lib/ApiError'
import { usePermissions } from '../lib/permissions'
import { Button, Feedback } from './ui'

/**
 * Protege a área da organização.
 *
 * - Sem sessão: manda para o login, guardando o destino.
 * - Conta sem organização (403 da API): volta para a home.
 * - Falha de rede: mostra erro com "Tentar novamente" em vez de expulsar a pessoa.
 */
export function OrganizacaoGuard({ children }: { children: ReactNode }) {
  const account = useDemoAccount()
  const location = useLocation()
  const permissions = usePermissions({ enabled: account.isAuthenticated })

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

  return <>{children}</>
}
