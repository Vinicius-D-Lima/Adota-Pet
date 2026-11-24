import { createHash, randomBytes } from 'node:crypto'
import {
  invitationTokenParamsSchema,
  organizationCreateSchema,
  organizationIdParamsSchema,
  organizationInvitationCreateSchema,
  organizationInvitationParamsSchema,
  organizationMemberParamsSchema,
  organizationMemberRoleSchema,
  type OrganizationCreatePayload,
  type OrganizationInvitationCreatePayload,
  type OrganizationMemberRolePayload,
} from '@adotapet/shared'
import { Router } from 'express'
import type { Request } from 'express'
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
  return membership
}

async function requireAdmin(req: Request, organizationId: string) {
  const membership = await requireMember(req, organizationId)
  if (membership.role !== 'ADMIN') {
    throw new HttpError(403, 'Somente administradores podem realizar esta ação')
  }
  return membership
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
    res.status(201).json({
      id: invitation.id,
      organizationId,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      status: invitation.status,
      acceptUrl: `/api/invitations/${token}/accept`,
    })
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
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { organization: true },
    })
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
