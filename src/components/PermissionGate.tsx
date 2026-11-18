import type { ReactNode } from 'react'
import { usePermissions } from '../lib/permissions'

interface PermissionGateProps {
  /** Permissão necessária, no formato `recurso:acao`. */
  permission?: string
  /** Basta ter uma destas permissões. */
  permissions?: string[]
  /** Conteúdo mostrado quando a pessoa não tem a permissão (por padrão, nada). */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Esconde ações para quem não tem permissão. Enquanto as permissões carregam,
 * nada é mostrado, para não piscar um botão que a pessoa não pode usar.
 */
export function PermissionGate({
  permission,
  permissions,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { data, isPending } = usePermissions()

  if (isPending || !data) return <>{fallback}</>

  const allowed = permission
    ? data.permissions.includes(permission)
    : (permissions?.some((item) => data.permissions.includes(item)) ?? false)

  return <>{allowed ? children : fallback}</>
}
