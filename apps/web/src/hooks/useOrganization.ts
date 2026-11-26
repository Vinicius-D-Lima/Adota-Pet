import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { petSchema, petsResponseSchema, type OrganizationRole, type Pet } from '@adotapet/shared'
import {
  receivedRequestSchema,
  receivedRequestsResponseSchema,
  type InterviewFormData,
  type OrganizationPetPayload,
  type ReceivedRequestsQuery,
} from '@adotapet/shared'
import { useActiveOrganizationId, useSelectedOrganizationId } from './useOrganizations'

/** Reexportado para as páginas da área não precisarem de dois imports de hooks. */
export { useActiveOrganizationId } from './useOrganizations'

/**
 * Todo dado da área é keyado pela organização ativa: trocar no seletor troca
 * o contexto das queries sem precisar recarregar a página.
 */
export const organizationKeys = {
  all: ['organization'] as const,
  pets: (organizationId = '') => [...organizationKeys.all, organizationId, 'pets'] as const,
  requests: (organizationId = '') => [...organizationKeys.all, organizationId, 'requests'] as const,
  request: (id: string, organizationId = '') =>
    [...organizationKeys.requests(organizationId), id] as const,
  details: (organizationId = '') => [...organizationKeys.all, organizationId, 'details'] as const,
  members: (organizationId = '') => [...organizationKeys.all, organizationId, 'members'] as const,
  invitations: (organizationId = '') =>
    [...organizationKeys.all, organizationId, 'invitations'] as const,
  adoptions: (organizationId = '') =>
    [...organizationKeys.all, organizationId, 'adoptions'] as const,
}

export type OrganizationRequestTransition = 'EM_ANALISE' | 'APROVADA' | 'RECUSADA'

/** Resposta de listas no formato `{ data, total }` (com fallback para array). */
function unwrapList<T>(response: T[] | { data?: T[] } | undefined): T[] {
  if (Array.isArray(response)) return response
  return response?.data ?? []
}

const scopedGetOptions = (organizationId: string) =>
  organizationId ? { query: { organizationId } } : undefined

export function useOrganizationPets(enabled = true) {
  const selectedOrganizationId = useSelectedOrganizationId()
  return useQuery({
    queryKey: organizationKeys.pets(selectedOrganizationId),
    queryFn: async () =>
      petsResponseSchema.parse(
        await api.get('/me/organization-pets', scopedGetOptions(selectedOrganizationId)),
      ).data,
    enabled,
  })
}

export type ReceivedRequestsOptions = Partial<ReceivedRequestsQuery> & { enabled?: boolean }

/**
 * A fila da instituição é filtrada no servidor (#ORG). O formato legado
 * `useReceivedRequests(boolean)` continua valendo para os callers antigos.
 */
export function useReceivedRequests(options: ReceivedRequestsOptions | boolean = {}) {
  const normalized: ReceivedRequestsOptions =
    typeof options === 'boolean' ? { enabled: options } : options
  const { stage, petId, enabled = true } = normalized
  const selectedOrganizationId = useSelectedOrganizationId()
  const params = new URLSearchParams()
  if (stage && stage !== 'all') params.set('stage', stage)
  if (petId) params.set('petId', petId)
  if (selectedOrganizationId) params.set('organizationId', selectedOrganizationId)
  const search = params.toString()

  return useQuery({
    queryKey: [...organizationKeys.requests(selectedOrganizationId), { stage, petId }],
    queryFn: async () =>
      receivedRequestsResponseSchema.parse(
        await api.get(`/me/received-requests${search ? `?${search}` : ''}`),
      ),
    enabled,
  })
}

export function useReceivedRequest(requestId: string | undefined) {
  const selectedOrganizationId = useSelectedOrganizationId()
  return useQuery({
    queryKey: organizationKeys.request(requestId ?? '', selectedOrganizationId),
    queryFn: async () =>
      receivedRequestSchema.parse(
        await api.get(`/me/received-requests/${encodeURIComponent(requestId ?? '')}`),
      ),
    enabled: Boolean(requestId),
  })
}

export function useSaveOrganizationPet() {
  const queryClient = useQueryClient()
  const selectedOrganizationId = useSelectedOrganizationId()
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: OrganizationPetPayload }) =>
      petSchema.parse(
        id
          ? await api.put(`/me/organization-pets/${encodeURIComponent(id)}`, data)
          : await api.post('/me/organization-pets', data),
      ),
    onSuccess: (pet: Pet) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.pets(selectedOrganizationId) })
      queryClient.invalidateQueries({ queryKey: ['pets'] })
      queryClient.invalidateQueries({ queryKey: ['pet', pet.id] })
    },
  })
}

export function useDeleteOrganizationPet() {
  const queryClient = useQueryClient()
  const selectedOrganizationId = useSelectedOrganizationId()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/me/organization-pets/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.pets(selectedOrganizationId) })
      queryClient.invalidateQueries({ queryKey: ['pets'] })
    },
  })
}

export function useUpdateReceivedRequestStatus() {
  const queryClient = useQueryClient()
  const selectedOrganizationId = useSelectedOrganizationId()
  return useMutation({
    mutationFn: async ({
      id,
      to,
      reason,
    }: {
      id: string
      to: OrganizationRequestTransition
      reason?: string
    }) =>
      receivedRequestSchema.parse(
        await api.post(`/me/received-requests/${encodeURIComponent(id)}/transitions`, {
          to,
          ...(reason ? { reason } : {}),
        }),
      ),
    // Também no erro: um 409 indica que o estado mudou e a lista precisa recarregar.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: organizationKeys.requests(selectedOrganizationId),
      }),
  })
}

export function useScheduleInterview() {
  const queryClient = useQueryClient()
  const selectedOrganizationId = useSelectedOrganizationId()
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: { type: InterviewFormData['type']; proposedSlots: string[] }
    }) =>
      receivedRequestSchema.parse(
        await api.post(`/me/received-requests/${encodeURIComponent(id)}/interview`, data),
      ),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: organizationKeys.requests(selectedOrganizationId),
      }),
  })
}

export function useCompleteInterview() {
  const queryClient = useQueryClient()
  const selectedOrganizationId = useSelectedOrganizationId()
  return useMutation({
    mutationFn: async (id: string) =>
      receivedRequestSchema.parse(
        await api.post(`/me/received-requests/${encodeURIComponent(id)}/interview/complete`),
      ),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: organizationKeys.requests(selectedOrganizationId),
      }),
  })
}

// --- Organização: dados, membros, convites e adoções (#41) ------------------

interface MembershipResponse {
  id: string
  userId: string
  role: OrganizationRole
  status?: 'ATIVO' | 'REMOVIDO'
  joinedAt?: string
  user?: { id?: string; name?: string; email?: string }
  name?: string
  email?: string
}

export interface OrganizationMember {
  id: string
  userId: string
  name: string
  email: string
  role: OrganizationRole
  status: 'ATIVO' | 'REMOVIDO'
  joinedAt?: string
}

function presentMember(member: MembershipResponse): OrganizationMember {
  return {
    id: member.id,
    userId: member.userId ?? member.user?.id ?? member.id,
    name: member.name ?? member.user?.name ?? '',
    email: member.email ?? member.user?.email ?? '',
    role: member.role,
    status: member.status ?? 'ATIVO',
    joinedAt: member.joinedAt,
  }
}

export interface OrganizationInvitation {
  id: string
  email: string
  role: OrganizationRole
  status: 'PENDENTE' | 'ACEITO' | 'EXPIRADO' | 'REVOGADO'
  expiresAt: string
  /** Token só é devolvido no momento da criação (e no mock, para copiar o link). */
  token?: string
  acceptUrl?: string
  organization?: { id?: string; name?: string; initials?: string } | null
  organizationName?: string
}

export interface InvitationPreview {
  email?: string
  role: OrganizationRole
  status?: OrganizationInvitation['status']
  expiresAt?: string
  organization?: { id?: string; name?: string; initials?: string } | null
  organizationName?: string
}

export interface OrganizationDetails {
  id: string
  name: string
  displayName?: string
  initials: string
  cnpj?: string | null
  document?: string | null
  phone?: string
  email?: string
  contactEmail?: string
  address?: string
  city?: string
  description?: string
  logoUrl?: string | null
}

/** Envia os nomes canônicos e os aliases aceitos pelas versões da API (#41). */
export interface OrganizationUpdatePayload {
  displayName: string
  name: string
  initials: string
  cnpj: string
  document: string
  phone: string
  email: string
  contactEmail: string
  address: string
  city: string
  description: string
}

export interface OrganizationAdoption {
  id: string
  adoptedAt: string
  adopterId?: string
  pet?: { id?: string; name?: string; image?: string; organization?: string } | null
  adopter?: { id?: string; name?: string; email?: string } | null
  plan?: { durationDays: number; intervalDays: number } | null
  checkIns?: Array<{ id?: string; dueDate?: string; status?: string }>
}

const organizationUrl = (organizationId: string, resource: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/${resource}`

export function useOrganizationDetails(organizationId?: string) {
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useQuery<OrganizationDetails>({
    queryKey: organizationKeys.details(id),
    queryFn: () => api.get<OrganizationDetails>(`/organizations/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  })
}

export function useOrganizationMembers(organizationId?: string) {
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useQuery<OrganizationMember[]>({
    queryKey: organizationKeys.members(id),
    queryFn: async () =>
      unwrapList<MembershipResponse>(
        await api.get<MembershipResponse[] | { data: MembershipResponse[] }>(
          organizationUrl(id, 'members'),
        ),
      ).map(presentMember),
    enabled: Boolean(id),
  })
}

export function useOrganizationInvitations(organizationId?: string) {
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useQuery<OrganizationInvitation[]>({
    queryKey: organizationKeys.invitations(id),
    queryFn: async () =>
      unwrapList<OrganizationInvitation>(
        await api.get<OrganizationInvitation[] | { data: OrganizationInvitation[] }>(
          organizationUrl(id, 'invitations'),
        ),
      ),
    enabled: Boolean(id),
  })
}

export function useOrganizationAdoptions(organizationId?: string) {
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useQuery<OrganizationAdoption[]>({
    queryKey: organizationKeys.adoptions(id),
    queryFn: async () =>
      unwrapList<OrganizationAdoption>(
        await api.get<OrganizationAdoption[] | { data: OrganizationAdoption[] }>('/me/adoptions'),
      ),
    enabled: Boolean(id),
  })
}

export function useInvitationPreview(token: string | undefined) {
  return useQuery<InvitationPreview>({
    queryKey: ['invitations', 'preview', token ?? ''],
    queryFn: () => api.get<InvitationPreview>(`/invitations/${encodeURIComponent(token ?? '')}`),
    enabled: Boolean(token),
  })
}

export function useUpdateOrganizationMember(organizationId?: string) {
  const queryClient = useQueryClient()
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrganizationRole }) =>
      api.patch<OrganizationMember>(organizationUrl(id, `members/${encodeURIComponent(userId)}`), {
        role,
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: organizationKeys.members(id) }),
  })
}

export function useRemoveOrganizationMember(organizationId?: string) {
  const queryClient = useQueryClient()
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(organizationUrl(id, `members/${encodeURIComponent(userId)}`)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: organizationKeys.members(id) }),
  })
}

export function useCreateOrganizationInvitation(organizationId?: string) {
  const queryClient = useQueryClient()
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useMutation({
    mutationFn: (data: { email: string; role: OrganizationRole }) =>
      api.post<OrganizationInvitation>(organizationUrl(id, 'invitations'), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(id) }),
  })
}

export function useRevokeOrganizationInvitation(organizationId?: string) {
  const queryClient = useQueryClient()
  const activeId = useActiveOrganizationId()
  const id = organizationId || activeId
  return useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(organizationUrl(id, `invitations/${encodeURIComponent(invitationId)}`)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(id) }),
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrganizationUpdatePayload }) =>
      api.put<OrganizationDetails>(`/organizations/${encodeURIComponent(id)}`, data),
    onSuccess: (organization) => {
      queryClient.setQueryData(organizationKeys.details(organization.id), organization)
      queryClient.invalidateQueries({ queryKey: organizationKeys.all })
      queryClient.invalidateQueries({ queryKey: ['me', 'permissions'] })
      queryClient.invalidateQueries({ queryKey: ['me', 'organizations'] })
    },
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      api.post<{ organization?: { id?: string }; membership?: { role?: OrganizationRole } }>(
        `/invitations/${encodeURIComponent(token)}/accept`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'permissions'] })
      queryClient.invalidateQueries({ queryKey: ['me', 'organizations'] })
    },
  })
}
