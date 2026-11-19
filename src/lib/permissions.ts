import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export interface OrganizationMembership {
  id: string
  name: string
  initials: string
}

export interface PermissionsResponse {
  role: 'ADMIN' | 'VOLUNTEER'
  canApprove: boolean
  permissions: string[]
  organization: OrganizationMembership | null
}

/** Nomes usados pela API simulada e pelo backend real (#28). */
export const PERMISSIONS = {
  view: 'requests:view',
  review: 'requests:review',
  approve: 'requests:approve',
  reject: 'requests:reject',
} as const

export function usePermissions(options?: { enabled?: boolean }) {
  return useQuery<PermissionsResponse>({
    queryKey: ['me', 'permissions'],
    queryFn: () => api.get('/me/permissions'),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCanApprove() {
  const { data } = usePermissions()
  return data?.canApprove ?? false
}

export function useHasPermission(permission: string) {
  const { data } = usePermissions()
  return data?.permissions.includes(permission) ?? false
}
