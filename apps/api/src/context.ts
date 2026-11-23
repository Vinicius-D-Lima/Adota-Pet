import {
  displayRequestStatus,
  permissionsForOrganizationRole,
  type OrganizationPermission,
  type OrganizationRole,
} from '@adotapet/shared'
import type { Request, Response } from 'express'
import { prisma } from './db.js'
import type { AdoptionRequest, ChatMessage, Pet, User } from './generated/prisma/client.js'
import { haversineKm, isBlank, sendError } from './http.js'
import { calculateRequestMatching } from './matching.js'
import {
  PROFILE_FIELDS,
  missingGuardianFields,
  missingProfileFields,
  optional,
} from './validation.js'

/** Usuário usado quando o pedido não informa `X-Demo-User-Id` (mesmo do mock). */
const defaultDemoUserId = () => process.env.DEMO_USER_ID ?? 'demo'

/** `null` vira `undefined` para a chave sumir do JSON (como no mock). */
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/** Resposta de perfil: campos podem faltar quando o cadastro ainda não existe. */
export interface ProfileView {
  userId: string
  isComplete: boolean
  missingFields: string[]
  [key: string]: unknown
}

/**
 * Usuário atual: identidade do JWT quando o middleware `requireAuth` rodou;
 * nos módulos legados ainda em migração, o cabeçalho demo continua valendo.
 */
export async function currentUser(req: Request): Promise<{ id: string; user: User | null }> {
  if (req.user) return { id: req.user.id, user: req.user }

  const requested = req.get('X-Demo-User-Id')
  if (requested) {
    const found = await prisma.user.findUnique({ where: { id: requested } })
    if (found) return { id: requested, user: found }
  }
  const fallback = defaultDemoUserId()
  return { id: fallback, user: await prisma.user.findUnique({ where: { id: fallback } }) }
}

/** Usuário de referência do cálculo de distância (o demo padrão, como no mock). */
export const referenceUser = () => prisma.user.findUnique({ where: { id: defaultDemoUserId() } })

/** Usuário sem coordenadas nem campos vazios: só o que o mock devolveria. */
export function publicUser(user: User) {
  const copy: Partial<User> = { ...user }
  delete copy.lat
  delete copy.lng
  // Nunca sair da API, nem em /me, nem em login/cadastro (AUTH-04).
  delete copy.passwordHash
  for (const key of Object.keys(copy) as (keyof User)[]) {
    if (copy[key] === null) delete copy[key]
  }
  return copy
}

/** `gallery` vazia não é enviada (o frontend trata igual a chave ausente). */
export const withGallery = <T extends { gallery: string[] }>(pet: T) => ({
  ...pet,
  gallery: pet.gallery.length ? pet.gallery : undefined,
})

/**
 * O cadastro grava os dados básicos em `User`, mas as telas de perfil leem
 * `AdopterProfile`/`GuardianProfile`. Contas criadas antes da sincronização
 * entre as tabelas ficaram com o perfil vazio; usar `User` como fallback garante
 * que o nome/e-mail/etc. apareçam de qualquer forma.
 */
const ACCOUNT_FIELDS = ['name', 'email', 'cpf', 'birthDate', 'phone', 'zipCode', 'address'] as const

function fillBlank(source: Record<string, unknown>, values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    if (isBlank(source[key]) && typeof value === 'string' && value.trim()) source[key] = value
  }
  return source
}

export async function getProfile(userId: string): Promise<ProfileView> {
  const [row, user] = await Promise.all([
    prisma.adopterProfile.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ])
  const source: Record<string, unknown> = { ...row }
  delete source.id
  const fallback: Record<string, unknown> = {}
  for (const field of ACCOUNT_FIELDS) fallback[field] = user?.[field]
  fillBlank(source, fallback)
  const missingFields = missingProfileFields(source)
  return { ...source, userId, isComplete: missingFields.length === 0, missingFields }
}

export async function getGuardianProfile(userId: string): Promise<ProfileView> {
  const [row, user] = await Promise.all([
    prisma.guardianProfile.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ])
  const source: Record<string, unknown> = { ...row }
  delete source.id
  const city = [user?.city, user?.state].filter(Boolean).join(', ')
  fillBlank(source, {
    guardianType: user?.guardianType,
    displayName: user?.organizationName || user?.name,
    legalName: user?.name,
    document: user?.document,
    email: user?.email,
    phone: user?.phone,
    zipCode: user?.zipCode,
    address: user?.address,
    city: city || undefined,
  })
  const missingFields = missingGuardianFields(source)
  return { ...source, userId, isComplete: missingFields.length === 0, missingFields }
}

/** Bloqueia a área da instituição quando o usuário não tem papel GUARDIAN. */
export async function requireGuardian(req: Request, res: Response): Promise<{ id: string } | null> {
  const { id, user } = await currentUser(req)
  if (user?.roles?.includes('GUARDIAN')) return { id }
  sendError(res, 403, 'Esta área é exclusiva para instituições e protetores')
  return null
}

/** Nome/iniciais da instituição dona dos pets (perfil > usuário > fallback). */
export async function organizationIdentity(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  const profile = await getGuardianProfile(userId)
  const name =
    str(profile.displayName) ||
    str(profile.legalName) ||
    user?.organizationName ||
    user?.name ||
    'Instituição'
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
  return { name, initials: initials || 'IN', user }
}

export const organizationPets = async (userId: string) => {
  const { name } = await organizationIdentity(userId)
  return prisma.pet.findMany({
    where: { organization: name },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  })
}

/**
 * Papel na instituição (#26/#28). Com JWT o cabeçalho `X-Demo-Role` é ignorado:
 * o cliente não pode decidir sua própria permissão. O papel vem do banco
 * (`User.organizationRole`); moderadores da plataforma continuam como ADMIN.
 */
export function demoRole(req: Request): OrganizationRole {
  if (req.auth) {
    if (req.auth.platformRole === 'MODERADOR') return 'ADMIN'
    const guardian = req.user?.roles?.includes('GUARDIAN') ?? false
    if (!guardian) return 'VOLUNTEER'
    return req.user?.organizationRole === 'VOLUNTEER' ? 'VOLUNTEER' : 'ADMIN'
  }
  const value = String(req.headers['x-demo-role'] || req.query.role || '').toUpperCase()
  return value === 'VOLUNTEER' ? 'VOLUNTEER' : 'ADMIN'
}

export const permissionsForRole = (role: OrganizationRole): OrganizationPermission[] =>
  permissionsForOrganizationRole(role)

/**
 * Aplicação server-side da matriz (#28/#RBAC): esconder o botão é só UX, então
 * toda ação da área da instituição passa por aqui. Chamar depois de
 * `requireGuardian`, que garante que o usuário pertence a uma instituição.
 */
export function requirePermission(
  req: Request,
  res: Response,
  permission: OrganizationPermission,
): boolean {
  if (permissionsForRole(demoRole(req)).includes(permission)) return true
  sendError(res, 403, 'Você não tem permissão para realizar esta ação.')
  return false
}

export const isChatParticipant = async (
  request: Pick<AdoptionRequest, 'userId' | 'petId'>,
  userId: string,
) => {
  if (request.userId === userId) return true
  const { name } = await organizationIdentity(userId)
  const count = await prisma.pet.count({ where: { organization: name, id: request.petId } })
  return count > 0
}

export const messagesForRequest = (requestId: string) =>
  prisma.chatMessage.findMany({
    where: { requestId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

export const unreadChatCount = (requestId: string, userId: string) =>
  prisma.chatMessage.count({
    where: { requestId, authorId: { not: userId }, readAt: null },
  })

export async function presentChatMessage(message: ChatMessage, userId: string) {
  const request = await prisma.adoptionRequest.findUnique({
    where: { id: message.requestId },
  })
  let authorName: string
  if (message.authorId === request?.userId) {
    const profile = await getProfile(message.authorId)
    const fallback = await prisma.user.findUnique({ where: { id: message.authorId } })
    authorName = str(profile.name) || fallback?.name || 'Adotante'
  } else {
    authorName = (await organizationIdentity(message.authorId)).name
  }
  return {
    id: message.id,
    authorName,
    mine: message.authorId === userId,
    body: message.body,
    createdAt: message.createdAt,
    readAt: message.readAt,
  }
}

export const withPet = async (request: AdoptionRequest) => {
  const pet = await prisma.pet.findUnique({ where: { id: request.petId } })
  return {
    ...request,
    // #20: o banco guarda códigos da FSM; o contrato público segue com os
    // rótulos legados consumidos pelo frontend.
    status: displayRequestStatus(request.status),
    // Campos que o mock só inclui quando gravados: `null` viraria chave presente
    // e o schema `optional()` do frontend rejeita null.
    answers: request.answers ?? undefined,
    interview: request.interview ?? undefined,
    rejectionReason: request.rejectionReason ?? undefined,
    pet: pet ? withGallery(pet) : null,
  }
}

/** Pet com distância calculada a partir do usuário demo padrão. */
export function presentPet(pet: Pet, refUser: User | null) {
  const row = withGallery(pet)
  const refLat = refUser?.lat
  const refLng = refUser?.lng
  if (
    typeof refLat !== 'number' ||
    typeof refLng !== 'number' ||
    typeof pet.lat !== 'number' ||
    typeof pet.lng !== 'number'
  ) {
    return { ...row, distanceKm: null, distance: null }
  }
  const distanceKm = Math.round(haversineKm(refLat, refLng, pet.lat, pet.lng) * 10) / 10
  return {
    ...row,
    distanceKm,
    distance: `${String(distanceKm).replace('.', ',')} km`,
  }
}

/** Visão da solicitação para a instituição (com dados do adotante). */
export async function withReceivedRequest(request: AdoptionRequest, viewerId: string) {
  const user = await prisma.user.findUnique({ where: { id: request.userId } })
  const profile = await getProfile(request.userId)
  const completed = PROFILE_FIELDS.length - profile.missingFields.length
  const base = await withPet(request)
  const adopter = {
    id: request.userId,
    name: str(profile.name) || user?.name || '',
    email: str(profile.email) || user?.email || '',
    phone: str(profile.phone) || user?.phone || '',
    completion: Math.round((completed / PROFILE_FIELDS.length) * 100),
    housing: optional(str(profile.housing)),
    dailyTime: optional(str(profile.dailyTime)),
    activityLevel: str(profile.activityLevel) || 'Moderado',
    hasOutdoorArea: profile.hasOutdoorArea ?? false,
    acceptsSpecialCare: profile.acceptsSpecialCare ?? false,
    experience: optional(str(profile.experience)),
    hasChildren: optional(profile.hasChildren),
    hasOtherPets: optional(profile.hasOtherPets),
    preferredSpecies: optional(str(profile.preferredSpecies)),
    preferredSize: optional(str(profile.preferredSize)),
    zipCode: optional(str(profile.zipCode)),
    address: optional(str(profile.address)),
    city: optional(user?.city),
  }
  return {
    ...base,
    unreadMessageCount: await unreadChatCount(request.id, viewerId),
    interview: request.interview ?? null,
    rejectionReason: request.rejectionReason ?? null,
    matching: calculateRequestMatching(base.pet, adopter),
    adopter,
  }
}
