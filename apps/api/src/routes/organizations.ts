import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  invitationTokenParamsSchema,
  organizationCreateSchema,
  organizationIdParamsSchema,
  organizationInvitationCreateSchema,
  organizationInvitationParamsSchema,
  organizationMemberParamsSchema,
  organizationMemberRoleSchema,
  organizationUpdateSchema,
  type OrganizationCreatePayload,
  type OrganizationInvitationCreatePayload,
  type OrganizationMemberRolePayload,
  type OrganizationUpdatePayload,
} from '@adotapet/shared'
import { Router } from 'express'
import type { Request } from 'express'
import { abilitySubject, accessibleBy, createAbility } from '../ability.js'
import { loadConfig } from '../config.js'
import { activeMemberships } from '../context.js'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError, list, sendError } from '../http.js'
import { validate } from '../validate.js'

export const organizationsRouter = Router()

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const normalizedEmail = (email: string) => email.trim().toLowerCase()

const publicOrganization = <
  T extends {
    id: string
    name: string
    initials: string
    description: string
    city: string
    contactEmail: string
    phone: string
    logoUrl: string | null
    cnpj: string | null
  },
>(
  organization: T,
) => ({
  id: organization.id,
  name: organization.name,
  initials: organization.initials,
  description: organization.description,
  city: organization.city,
  contactEmail: organization.contactEmail,
  phone: organization.phone,
  logoUrl: organization.logoUrl,
  cnpj: organization.cnpj,
})

async function activeMembership(organizationId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  })
}

async function requireMember(req: Request, organizationId: string) {
  const membership = await activeMembership(organizationId, req.user!.id)
  if (!membership || membership.status !== 'ATIVO') {
    throw new HttpError(403, 'Você não pertence a esta organização')
  }
  const ability = createAbility({ role: membership.role, organizationIds: [organizationId] })
  if (!ability.can('read', abilitySubject('Organization', organizationId))) {
    throw new HttpError(403, 'Você não pertence a esta organização')
  }
  return membership
}

/** Todo poder é condicionado ao `organizationId` do membro (RBAC-05). */
async function requireAdmin(req: Request, organizationId: string) {
  const membership = await requireMember(req, organizationId)
  const ability = createAbility({ role: membership.role, organizationIds: [organizationId] })
  if (!ability.can('manage', abilitySubject('Membership', organizationId))) {
    throw new HttpError(403, 'Somente administradores podem realizar esta ação')
  }
  return membership
}

type InvitationView = {
  id: string
  organizationId: string
  email: string
  role: 'ADMIN' | 'VOLUNTEER'
  expiresAt: string
  status: 'PENDENTE' | 'ACEITO' | 'EXPIRADO' | 'REVOGADO'
  acceptUrl: string
}

const invitationView = (invitation: {
  id: string
  organizationId: string
  email: string
  role: 'ADMIN' | 'VOLUNTEER'
  expiresAt: Date
  status: 'PENDENTE' | 'ACEITO' | 'EXPIRADO' | 'REVOGADO'
  token: string
}): InvitationView => ({
  id: invitation.id,
  organizationId: invitation.organizationId,
  email: invitation.email,
  role: invitation.role,
  expiresAt: invitation.expiresAt.toISOString(),
  status: invitation.status,
  acceptUrl: `/api/invitations/${invitation.token}/accept`,
})

/**
 * O banco guarda só o SHA-256 do token aleatório (ORG-05), então a listagem não
 * pode reconstruí-lo. Para devolver `acceptUrl` sem persistir segredo, geramos
 * um token assinado (HMAC) com o mesmo `JWT_SECRET`; a aceitação aceita os
 * dois formatos. O token original do POST continua aleatório e de alta entropia.
 */
const SIGNED_TOKEN_PREFIX = 's.'
const signedTokenSignature = (payload: string) =>
  createHmac('sha256', loadConfig().JWT_SECRET).update(payload).digest('base64url')

function signedInvitationToken(invitation: { id: string; expiresAt: Date }) {
  const payload = `${invitation.id}.${invitation.expiresAt.getTime()}`
  return `${SIGNED_TOKEN_PREFIX}${payload}.${signedTokenSignature(payload)}`
}

function invitationIdFromSignedToken(token: string): string | null {
  if (!token.startsWith(SIGNED_TOKEN_PREFIX)) return null
  const [id, expiresAt, signature] = token.slice(SIGNED_TOKEN_PREFIX.length).split('.')
  if (!id || !expiresAt || !signature) return null
  const expected = signedTokenSignature(`${id}.${expiresAt}`)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null
  }
  return Number.isFinite(Number(expiresAt)) ? id : null
}

async function invitationWithOrganization(token: string) {
  const byHash = await prisma.invitation.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { organization: true },
  })
  if (byHash) return byHash
  const signedId = invitationIdFromSignedToken(token)
  if (!signedId) return null
  return prisma.invitation.findUnique({
    where: { id: signedId },
    include: { organization: true },
  })
}

function conflictFromUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new HttpError(409, 'Já existe uma organização com esses dados')
  }
  throw error
}

organizationsRouter.post(
  '/organizations',
  validate({ body: organizationCreateSchema }),
  async (req, res) => {
    const body = req.body as OrganizationCreatePayload
    try {
      const result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: { ...body, initials: body.initials.toUpperCase() },
        })
        const membership = await tx.membership.create({
          data: {
            userId: req.user!.id,
            organizationId: organization.id,
            role: 'ADMIN',
            status: 'ATIVO',
          },
        })
        const roles = [...new Set([...req.user!.roles, 'GUARDIAN'])]
        await tx.user.update({ where: { id: req.user!.id }, data: { roles } })
        return { organization, membership }
      })
      res.status(201).json({
        ...publicOrganization(result.organization),
        membership: result.membership,
      })
    } catch (error) {
      conflictFromUnique(error)
    }
  },
)

organizationsRouter.get(
  '/organizations/:organizationId',
  validate({ params: organizationIdParamsSchema }),
  async (req, res) => {
    const { organizationId } = req.params as { organizationId: string }
    await requireMember(req, organizationId)
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!organization) return sendError(res, 404, 'Organização não encontrada')
    res.json(publicOrganization(organization))
  },
)

organizationsRouter.get(
  '/organizations/:organizationId/members',
  validate({ params: organizationIdParamsSchema }),
  async (req, res) => {
    const { organizationId } = req.params as { organizationId: string }
    await requireMember(req, organizationId)
    const memberships = await prisma.membership.findMany({
      where: { organizationId, status: 'ATIVO' },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    res.json(list(memberships))
  },
)

organizationsRouter.post(
  '/organizations/:organizationId/invitations',
  validate({ params: organizationIdParamsSchema, body: organizationInvitationCreateSchema }),
  async (req, res) => {
    const { organizationId } = req.params as { organizationId: string }
    const body = req.body as OrganizationInvitationCreatePayload
    await requireAdmin(req, organizationId)

    const organization = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!organization) return sendError(res, 404, 'Organização não encontrada')

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (user) {
      const membership = await activeMembership(organizationId, user.id)
      if (membership?.status === 'ATIVO') {
        return sendError(res, 409, 'Este usuário já pertence à organização')
      }
    }
    const pending = await prisma.invitation.findFirst({
      where: {
        organizationId,
        email: body.email,
        status: 'PENDENTE',
        expiresAt: { gt: new Date() },
      },
    })
    if (pending) return sendError(res, 409, 'Já existe um convite pendente para este e-mail')

    // 32 bytes = 256 bits de entropia. Só o hash SHA-256 chega ao banco (ORG-05).
    const token = randomBytes(32).toString('base64url')
    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        email: body.email,
        role: body.role,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    })
    res.status(201).json(invitationView({ ...invitation, token }))
  },
)

/** Seletor de organização do frontend (#41): só vínculos ativos. */
organizationsRouter.get('/me/organizations', async (req, res) => {
  const memberships = await activeMemberships(req.user!.id)
  res.json(
    list(
      memberships.map((membership) => ({
        id: membership.organizationId,
        name: membership.organization.name,
        initials: membership.organization.initials,
        role: membership.role,
      })),
    ),
  )
})

organizationsRouter.put(
  '/organizations/:organizationId',
  validate({ params: organizationIdParamsSchema, body: organizationUpdateSchema }),
  async (req, res) => {
    const { organizationId } = req.params as { organizationId: string }
    const body = req.body as OrganizationUpdatePayload
    const membership = await requireAdmin(req, organizationId)
    const ability = createAbility({ role: membership.role, organizationIds: [organizationId] })
    if (!ability.can('update', abilitySubject('Organization', organizationId))) {
      throw new HttpError(403, 'Somente administradores podem editar a organização')
    }

    const data: Prisma.OrganizationUncheckedUpdateInput = {}
    const text = (
      value: string | undefined,
      field: keyof Prisma.OrganizationUncheckedUpdateInput,
    ) => {
      if (typeof value === 'string' && value.trim()) Object.assign(data, { [field]: value })
    }
    text(body.name ?? body.displayName, 'name')
    text(body.initials, 'initials')
    text(body.phone, 'phone')
    text(body.contactEmail ?? body.email, 'contactEmail')
    // `address` é aceito (alias do formulário) mas não existe como coluna; os
    // demais aliases já foram resolvidos acima para os nomes canônicos.
    text(body.city, 'city')
    text(body.description, 'description')
    text(body.logoUrl, 'logoUrl')
    const document = body.cnpj ?? body.document
    if (document !== undefined) data.cnpj = document.trim() || null

    try {
      const organization = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`
        return tx.organization.update({ where: { id: organizationId }, data })
      })
      res.json(publicOrganization(organization))
    } catch (error) {
      conflictFromUnique(error)
    }
  },
)

organizationsRouter.get(
  '/organizations/:organizationId/invitations',
  validate({ params: organizationIdParamsSchema }),
  async (req, res) => {
    const { organizationId } = req.params as { organizationId: string }
    const membership = await requireAdmin(req, organizationId)
    const ability = createAbility({ role: membership.role, organizationIds: [organizationId] })
    const invitations = await prisma.invitation.findMany({
      where: {
        AND: [accessibleBy(ability, 'read', 'Invitation'), { organizationId }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    })
    res.json(
      list(
        invitations.map((invitation) =>
          invitationView({ ...invitation, token: signedInvitationToken(invitation) }),
        ),
      ),
    )
  },
)

organizationsRouter.delete(
  '/organizations/:organizationId/invitations/:invitationId',
  validate({ params: organizationInvitationParamsSchema }),
  async (req, res) => {
    const { organizationId, invitationId } = req.params as {
      organizationId: string
      invitationId: string
    }
    await requireAdmin(req, organizationId)
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId },
    })
    if (!invitation) return sendError(res, 404, 'Convite não encontrado')
    if (invitation.status === 'ACEITO') return sendError(res, 400, 'Este convite já foi usado')
    if (invitation.status === 'EXPIRADO' || invitation.expiresAt <= new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRADO' } })
      return sendError(res, 410, 'Este convite expirou')
    }
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'REVOGADO' } })
    res.status(204).end()
  },
)

organizationsRouter.post(
  '/invitations/:token/accept',
  validate({ params: invitationTokenParamsSchema }),
  async (req, res) => {
    const { token } = req.params as { token: string }
    const invitation = await invitationWithOrganization(token)
    if (!invitation) return sendError(res, 400, 'Convite inválido')
    if (invitation.status === 'ACEITO') return sendError(res, 400, 'Este convite já foi usado')
    if (invitation.status === 'REVOGADO') return sendError(res, 410, 'Este convite foi revogado')
    if (invitation.status === 'EXPIRADO' || invitation.expiresAt <= new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRADO' } })
      return sendError(res, 410, 'Este convite expirou')
    }
    if (normalizedEmail(req.user!.email) !== normalizedEmail(invitation.email)) {
      return sendError(res, 403, 'Este convite pertence a outra conta')
    }

    const membership = await prisma.$transaction(async (tx) => {
      const accepted = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDENTE', expiresAt: { gt: new Date() } },
        data: { status: 'ACEITO', acceptedAt: new Date() },
      })
      if (accepted.count !== 1) throw new HttpError(400, 'Este convite já foi usado')
      const row = await tx.membership.upsert({
        where: {
          userId_organizationId: {
            userId: req.user!.id,
            organizationId: invitation.organizationId,
          },
        },
        create: {
          userId: req.user!.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          status: 'ATIVO',
        },
        update: { role: invitation.role, status: 'ATIVO', joinedAt: new Date() },
      })
      const roles = [...new Set([...req.user!.roles, 'GUARDIAN'])]
      await tx.user.update({ where: { id: req.user!.id }, data: { roles } })
      return row
    })
    res.json({ organization: publicOrganization(invitation.organization), membership })
  },
)

organizationsRouter.patch(
  '/organizations/:organizationId/members/:userId',
  validate({ params: organizationMemberParamsSchema, body: organizationMemberRoleSchema }),
  async (req, res) => {
    const { organizationId, userId } = req.params as { organizationId: string; userId: string }
    const { role } = req.body as OrganizationMemberRolePayload
    await requireAdmin(req, organizationId)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`
      const target = await tx.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      })
      if (!target || target.status !== 'ATIVO') throw new HttpError(404, 'Membro não encontrado')
      if (target.role === 'ADMIN' && role !== 'ADMIN') {
        const admins = await tx.membership.count({
          where: { organizationId, role: 'ADMIN', status: 'ATIVO' },
        })
        if (admins <= 1) throw new HttpError(409, 'A organização precisa manter ao menos um ADMIN')
      }
      return tx.membership.update({ where: { id: target.id }, data: { role } })
    })
    res.json(updated)
  },
)

organizationsRouter.delete(
  '/organizations/:organizationId/members/:userId',
  validate({ params: organizationMemberParamsSchema }),
  async (req, res) => {
    const { organizationId, userId } = req.params as { organizationId: string; userId: string }
    await requireAdmin(req, organizationId)

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`
      const target = await tx.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
      })
      if (!target || target.status !== 'ATIVO') throw new HttpError(404, 'Membro não encontrado')
      if (target.role === 'ADMIN') {
        const admins = await tx.membership.count({
          where: { organizationId, role: 'ADMIN', status: 'ATIVO' },
        })
        if (admins <= 1) throw new HttpError(409, 'A organização precisa manter ao menos um ADMIN')
      }
      await tx.membership.update({ where: { id: target.id }, data: { status: 'REMOVIDO' } })
    })
    res.status(204).end()
  },
)

/**
 * Prévia pública do convite: quem abre o link pode ainda não estar logado, por
 * isso este router é montado antes do middleware de autenticação (#41).
 */
export const publicInvitationRouter = Router()

publicInvitationRouter.get(
  '/invitations/:token',
  validate({ params: invitationTokenParamsSchema }),
  async (req, res) => {
    const { token } = req.params as { token: string }
    const invitation = await invitationWithOrganization(token)
    if (!invitation) return sendError(res, 400, 'Convite inválido')
    const status =
      invitation.status === 'PENDENTE' && invitation.expiresAt <= new Date()
        ? 'EXPIRADO'
        : invitation.status
    if (status === 'EXPIRADO') return sendError(res, 410, 'Este convite expirou')
    if (status === 'REVOGADO') return sendError(res, 410, 'Este convite foi revogado')
    if (status === 'ACEITO') return sendError(res, 400, 'Este convite já foi usado')
    res.json({
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        initials: invitation.organization.initials,
      },
      role: invitation.role,
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
      status,
    })
  },
)
