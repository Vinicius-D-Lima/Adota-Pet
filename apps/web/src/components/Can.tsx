import type { ReactNode } from 'react'
import { canDo, usePermissions, type UsePermissionsOptions } from '../lib/permissions'

interface CanProps extends UsePermissionsOptions {
  /** Ação da regra (por exemplo `read`, `update`, `approve`, `manage`). */
  do: string
  /** Assunto da regra (por exemplo `Member`, `Organization`, `Request`). */
  on: string
  children?: ReactNode | ((allowed: boolean) => ReactNode)
  fallback?: ReactNode
}

/**
 * Equivalente local do `<Can do="..." on="...">` do @casl/react, sem nova
 * dependência: as regras vêm de `GET /me/permissions` via `usePermissions`.
 * Enquanto carrega, nada é exibido para não "piscar" uma ação proibida.
 */
export function Can({
  do: action,
  on: subject,
  children,
  fallback = null,
  enabled,
  organizationId,
}: CanProps) {
  const { data, isPending } = usePermissions({ enabled, organizationId })
  if (isPending || !data) return <>{fallback}</>

  const allowed = canDo(data, action, subject)
  return <>{typeof children === 'function' ? children(allowed) : allowed ? children : fallback}</>
}
