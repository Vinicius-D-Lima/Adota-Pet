/** Ponto de entrada estável para as permissões do frontend (#41). */
export {
  PERMISSIONS,
  canDo,
  inferredRules,
  useCan,
  useCanApprove,
  useHasPermission,
  usePermissions,
} from '../lib/permissions'
export type {
  OrganizationMembership,
  OrganizationRole,
  PermissionRule,
  PermissionsResponse,
  UsePermissionsOptions,
} from '../lib/permissions'

import { usePermissions } from '../lib/permissions'
import { useSelectedOrganizationId } from './useOrganizations'

/** Permissões da organização selecionada no seletor da área. */
export function useActivePermissions() {
  return usePermissions({ organizationId: useSelectedOrganizationId() })
}
