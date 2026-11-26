import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { ApiError } from '../lib/ApiError'
import { api } from '../lib/api'
import {
  usePermissions,
  type OrganizationMembership,
  type UsePermissionsOptions,
} from '../lib/permissions'

const SELECTED_KEY = 'adotapet:selected-organization'
const CHANGE_EVENT = 'adotapet:selected-organization-change'

/** A organização ativa fica na sessão para sobreviver a navegação entre páginas. */
export function getSelectedOrganizationId(): string {
  try {
    return sessionStorage.getItem(SELECTED_KEY) ?? ''
  } catch {
    return ''
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useSelectedOrganizationId(): string {
  return useSyncExternalStore(subscribe, getSelectedOrganizationId, () => '')
}

export function selectOrganization(organizationId: string) {
  try {
    sessionStorage.setItem(SELECTED_KEY, organizationId)
  } catch {
    // Sessão indisponível (modo privado): o estado ainda dura até o fim da página.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Troca o contexto e recarrega todos os dados da área (#41). */
export function useSwitchOrganization() {
  const queryClient = useQueryClient()
  return useCallback(
    (organizationId: string) => {
      selectOrganization(organizationId)
      void queryClient.invalidateQueries({ queryKey: ['organization'] })
      void queryClient.invalidateQueries({ queryKey: ['me', 'permissions'] })
      void queryClient.invalidateQueries({ queryKey: ['me', 'organizations'] })
    },
    [queryClient],
  )
}

export interface UseOrganizationsOptions extends UsePermissionsOptions {
  enabled?: boolean
}

/**
 * Lista as organizações do usuário. Enquanto `GET /me/organizations` não existe
 * no backend, usa `organizations`/`organization` de `GET /me/permissions`.
 */
export function useOrganizations(options?: UseOrganizationsOptions) {
  const permissions = usePermissions({
    enabled: options?.enabled,
    organizationId: options?.organizationId,
  })

  return useQuery<OrganizationMembership[]>({
    queryKey: ['me', 'organizations'],
    queryFn: async () => {
      const fallback = permissions.data?.organizations?.length
        ? permissions.data.organizations
        : permissions.data?.organization
          ? [permissions.data.organization]
          : []

      try {
        const response = await api.get<
          OrganizationMembership[] | { data: OrganizationMembership[] }
        >('/me/organizations')
        const list = Array.isArray(response) ? response : response?.data
        if (Array.isArray(list) && list.length > 0) return list
      } catch (error) {
        // Endpoint opcional: 404/403/405/501 significam "ainda não existe".
        const unavailable =
          error instanceof ApiError && [403, 404, 405, 501].includes(error.statusCode)
        if (!unavailable) throw error
      }
      return fallback
    },
    enabled: (options?.enabled ?? true) && permissions.isSuccess,
    staleTime: 30 * 1000,
  })
}

/** ID usado pelas páginas da área; o seletor tem prioridade sobre /me/permissions. */
export function useActiveOrganizationId(): string {
  const selected = useSelectedOrganizationId()
  const permissions = usePermissions({ enabled: !selected })
  return selected || permissions.data?.organization?.id || ''
}
