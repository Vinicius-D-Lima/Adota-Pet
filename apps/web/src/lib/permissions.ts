import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export type OrganizationRole = 'ADMIN' | 'VOLUNTEER'

export interface OrganizationMembership {
  id: string
  name: string
  initials: string
  /** Papel desta pessoa na organização, quando a API informa. */
  role?: OrganizationRole
}

/**
 * Regra no estilo CASL usada pelo componente `<Can>`.
 * `manage`/`all`/`*` funcionam como curingas; `conditions` é informação extra
 * (por exemplo `{ organizationId }`) e não altera a checagem local.
 */
export interface PermissionRule {
  action: string | string[]
  subject: string | string[]
  conditions?: Record<string, unknown>
}

export interface PermissionsResponse {
  role: OrganizationRole
  canApprove: boolean
  permissions: string[]
  organization: OrganizationMembership | null
  /** Todas as organizações das quais a pessoa é membro. */
  organizations?: OrganizationMembership[]
  /** Regras CASL devolvidas pela API; quando ausentes, são inferidas do papel. */
  rules?: PermissionRule[]
}

/** Nomes usados pela API simulada e pelo backend real (#28). */
export const PERMISSIONS = {
  view: 'requests:view',
  review: 'requests:review',
  approve: 'requests:approve',
  reject: 'requests:reject',
} as const

export interface UsePermissionsOptions {
  enabled?: boolean
  /** Organização ativa no seletor; vira `?organizationId=` na requisição. */
  organizationId?: string
}

export function usePermissions(options?: UsePermissionsOptions) {
  const organizationId = options?.organizationId ?? ''
  return useQuery<PermissionsResponse>({
    queryKey: ['me', 'permissions', organizationId],
    queryFn: () =>
      api.get<PermissionsResponse>(
        '/me/permissions',
        organizationId ? { query: { organizationId } } : undefined,
      ),
    enabled: options?.enabled ?? true,
    // Um papel alterado por um ADMIN precisa aparecer sem esperar 5 minutos.
    staleTime: 30 * 1000,
  })
}

const listOf = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value])

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase()

/** `view`/`read` e `update`/`edit` são aliases usados por regras diferentes. */
const actionAliases: Record<string, string[]> = {
  read: ['read', 'view'],
  view: ['view', 'read'],
  update: ['update', 'edit', 'manage'],
  edit: ['edit', 'update', 'manage'],
}

function actionMatches(ruleActions: string[], action: string): boolean {
  const accepted = actionAliases[action.toLowerCase()] ?? [action]
  return ruleActions.some((ruleAction) => {
    const current = ruleAction.toLowerCase()
    return current === '*' || current === 'manage' || accepted.some((item) => same(item, current))
  })
}

function subjectMatches(ruleSubjects: string[], subject: string): boolean {
  return ruleSubjects.some(
    (ruleSubject) => ruleSubject === '*' || same(ruleSubject, 'all') || same(ruleSubject, subject),
  )
}

/** Regras locais quando a API ainda não devolve `rules` (#28). */
export function inferredRules(data: PermissionsResponse): PermissionRule[] {
  if (data.role === 'ADMIN') return [{ action: 'manage', subject: 'all' }]

  const rules: PermissionRule[] = [
    { action: 'read', subject: 'Pet' },
    { action: 'read', subject: 'Organization' },
    { action: 'read', subject: 'Adoption' },
  ]
  const add = (permission: string, action: string, subject: string) => {
    if (data.permissions.includes(permission)) rules.push({ action, subject })
  }
  add(PERMISSIONS.view, 'read', 'Request')
  add(PERMISSIONS.review, 'review', 'Request')
  add(PERMISSIONS.approve, 'approve', 'Request')
  add(PERMISSIONS.reject, 'reject', 'Request')
  return rules
}

/** Avalia `do`/`on` usando as regras da API ou o fallback por papel. */
export function canDo(
  data: PermissionsResponse | undefined,
  action: string,
  subject: string,
): boolean {
  if (!data) return false
  const rules = data.rules?.length ? data.rules : inferredRules(data)
  return rules.some(
    (rule) =>
      actionMatches(listOf(rule.action), action) && subjectMatches(listOf(rule.subject), subject),
  )
}

export function useCan(action: string, subject: string, options?: UsePermissionsOptions): boolean {
  const { data } = usePermissions(options)
  return canDo(data, action, subject)
}

export function useCanApprove() {
  const { data } = usePermissions()
  return data?.canApprove ?? false
}

export function useHasPermission(permission: string) {
  const { data } = usePermissions()
  return data?.permissions.includes(permission) ?? false
}
