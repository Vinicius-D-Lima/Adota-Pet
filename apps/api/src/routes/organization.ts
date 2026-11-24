import {
  emptyRequestStageCounters,
  interviewApiSchema,
  organizationRequestStageOf,
  organizationTransitionSchema,
  receivedRequestsQuerySchema,
  requestStatusCodeOf,
  type InterviewApiPayload,
  type OrganizationTransitionPayload,
  type ReceivedRequestsQuery,
  type RequestStatusCode,
} from '@adotapet/shared'
import type { Request } from 'express'
import { Router } from 'express'
import {
  demoRole,
  organizationIdentity,
  organizationPets,
  permissionsForRole,
  publicPet,
  requireGuardian,
  requirePermission,
  withReceivedRequest,
  type PetWithOrganization,
} from '../context.js'
import { prisma } from '../db.js'
import { APPOINTMENT_CONFIRMED, APPOINTMENT_PROPOSED, enqueueDomainEvent } from '../events.js'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError, list, sendError } from '../http.js'
import { applyTransition } from '../requestStatusMachine.js'
import { deleteStorageObjectsForResource } from '../storage.js'
import { validate } from '../validate.js'
import { ORGANIZATION_PET_FIELDS, asRecord, validateOrganizationPet } from '../validation.js'

export const organizationRouter = Router()

/** Adapter dos códigos antigos da área da instituição para a FSM (#20). */
const ORGANIZATION_REQUEST_TRANSITIONS: Record<string, RequestStatusCode> = {
  EM_ANALISE: 'ANALISE_QUESTIONARIO',
  APROVADA: 'APROVADA',
  RECUSADA: 'RECUSADA',
}
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
const presentOrganizationPet = (pet: PetWithOrganization) => ({
  ...publicPet(pet),
  distance: null,
  distanceKm: null,
})

const petNameOf = async (petId: string) =>
  (await prisma.pet.findUnique({ where: { id: petId }, select: { name: true } }))?.name ?? 'pet'

/** Solicitação dos pets da instituição ou `null` (com 404 já enviado). */
async function receivedRequestOf(req: Request, viewerId: string) {
  const petIds = (await organizationPets(viewerId)).map(({ id }) => id)
  const request = await prisma.adoptionRequest.findFirst({
    where: { id: String(req.params.id), petId: { in: petIds } },
  })
  return request
}

organizationRouter.get('/me/organization-pets', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  const pets = await organizationPets(viewer.id)
  res.json(list(pets.map(presentOrganizationPet)))
})

organizationRouter.post('/me/organization-pets', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  const details = validateOrganizationPet(req.body)
  if (details.length) return sendError(res, 400, 'Validação falhou', details)

  const body = asRecord(req.body)
  if (!body)
    return sendError(res, 400, 'Validação falhou', [
      { field: 'body', message: 'Envie um objeto JSON' },
    ])

  const { organizationId, user } = await organizationIdentity(viewer.id)
  if (!organizationId) return sendError(res, 409, 'Crie uma organização antes de cadastrar pets')
  const baseId =
    String(body.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'pet'
  let id = baseId
  let suffix = 2
  while (await prisma.pet.findUnique({ where: { id } })) id = `${baseId}-${suffix++}`

  const data: Partial<Prisma.PetUncheckedCreateInput> = {
    id,
    ageLabel: `${body.age} ${body.age === 1 ? 'ano' : 'anos'}`,
    gallery: [String(body.image)],
    organizationId,
    lat: typeof user?.lat === 'number' ? user.lat : -23.5505,
    lng: typeof user?.lng === 'number' ? user.lng : -46.6333,
    createdAt: new Date(),
  }
  // Campos validados por ORGANIZATION_PET_FIELDS (o Prisma exige todos de uma vez).
  for (const key of ORGANIZATION_PET_FIELDS) Object.assign(data, { [key]: body[key] })

  const pet = await prisma.pet.create({
    data: data as Prisma.PetUncheckedCreateInput,
    include: { organizationEntity: true },
  })
  res.status(201).json(presentOrganizationPet(pet))
})

organizationRouter.put('/me/organization-pets/:id', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  const identity = await organizationIdentity(viewer.id)
  if (!identity.organizationId) return sendError(res, 404, 'Organização não encontrada')
  const existing = await prisma.pet.findFirst({
    where: { id: req.params.id, organizationId: identity.organizationId },
    include: { organizationEntity: true },
  })
  if (!existing) return sendError(res, 404, 'Pet não encontrado entre os cadastros da instituição')

  const details = validateOrganizationPet(req.body)
  if (details.length) return sendError(res, 400, 'Validação falhou', details)

  const body = asRecord(req.body)
  if (!body)
    return sendError(res, 400, 'Validação falhou', [
      { field: 'body', message: 'Envie um objeto JSON' },
    ])

  const image = String(body.image)
  const data: Prisma.PetUncheckedUpdateInput = {
    ageLabel: `${body.age} ${body.age === 1 ? 'ano' : 'anos'}`,
    gallery: existing.gallery?.length
      ? [image, ...existing.gallery.filter((item) => item !== image)]
      : [image],
  }
  for (const key of ORGANIZATION_PET_FIELDS) Object.assign(data, { [key]: body[key] })

  const updated = await prisma.pet.update({
    where: { id: existing.id },
    data,
    include: { organizationEntity: true },
  })
  res.json(presentOrganizationPet(updated))
})

organizationRouter.delete('/me/organization-pets/:id', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  const identity = await organizationIdentity(viewer.id)
  if (!identity.organizationId) return sendError(res, 404, 'Organização não encontrada')
  const existing = await prisma.pet.findFirst({
    where: { id: req.params.id, organizationId: identity.organizationId },
  })
  if (!existing) return sendError(res, 404, 'Pet não encontrado entre os cadastros da instituição')

  const requests = await prisma.adoptionRequest.count({ where: { petId: existing.id } })
  if (requests > 0)
    return sendError(res, 409, 'Não é possível remover um pet que possui solicitações')

  // Favoritos caem em cascata (onDelete: Cascade no schema). A limpeza de
  // arquivos é explícita (#94/STO-08) para não deixar órfãos no bucket.
  await deleteStorageObjectsForResource('PET', existing.id)
  await prisma.pet.delete({ where: { id: existing.id } })
  res.status(204).end()
})

organizationRouter.get('/me/permissions', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  if (!requirePermission(req, res, 'requests:view')) return
  const role = demoRole(req)
  const identity = await organizationIdentity(viewer.id)
  res.json({
    role,
    canApprove: role === 'ADMIN',
    permissions: permissionsForRole(role),
    organization: {
      id: identity.organizationId ?? viewer.id,
      name: identity.name,
      initials: identity.initials,
    },
  })
})

organizationRouter.get(
  '/me/received-requests',
  validate({ query: receivedRequestsQuerySchema }),
  async (req, res) => {
    const viewer = await requireGuardian(req, res)
    if (!viewer) return
    if (!requirePermission(req, res, 'requests:view')) return

    const { stage, petId } = req.query as unknown as ReceivedRequestsQuery
    const pets = await organizationPets(viewer.id)
    const petIds = pets.map(({ id }) => id)
    const requests = await prisma.adoptionRequest.findMany({
      where: { petId: { in: petIds } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    })

    // Contadores respeitam o pet selecionado e são calculados antes da etapa,
    // para que as abas mostrem a distribuição real da fila filtrada.
    const scoped = petId ? requests.filter((request) => request.petId === petId) : requests
    const counters = emptyRequestStageCounters()
    counters.all = scoped.length
    for (const request of scoped) counters[organizationRequestStageOf(request)] += 1

    const selected =
      stage === 'all'
        ? scoped
        : scoped.filter((request) => organizationRequestStageOf(request) === stage)
    const data = await Promise.all(
      selected.map((request) => withReceivedRequest(request, viewer.id)),
    )
    res.json({ ...list(data), counters, pets: pets.map(presentOrganizationPet) })
  },
)

organizationRouter.get('/me/received-requests/:id', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  if (!requirePermission(req, res, 'requests:view')) return
  const request = await receivedRequestOf(req, viewer.id)
  if (!request) return sendError(res, 404, 'Solicitação não encontrada')
  res.json(await withReceivedRequest(request, viewer.id))
})

organizationRouter.post(
  '/me/received-requests/:id/interview',
  validate({ body: interviewApiSchema }),
  async (req, res) => {
    const viewer = await requireGuardian(req, res)
    if (!viewer) return
    if (!requirePermission(req, res, 'requests:review')) return
    const request = await receivedRequestOf(req, viewer.id)
    if (!request) return sendError(res, 404, 'Solicitação não encontrada')
    if (requestStatusCodeOf(request.status) !== 'ANALISE_QUESTIONARIO') {
      return sendError(
        res,
        409,
        'Só é possível agendar uma entrevista com a solicitação em análise.',
      )
    }
    const scheduled = asRecord(request.interview)
    if (scheduled?.completed) {
      return sendError(res, 409, 'A entrevista desta solicitação já foi realizada.')
    }

    const { type, proposedSlots } = req.body as InterviewApiPayload
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.adoptionRequest.update({
        where: { id: request.id },
        data: {
          interview: {
            type,
            proposedSlots,
            status: 'AGENDADA',
            completed: false,
            scheduledAt: new Date().toISOString(),
          },
        },
      })
      // NOT: evento e agendamento entram juntos (o worker publica depois).
      await enqueueDomainEvent(tx, APPOINTMENT_PROPOSED, {
        requestId: row.id,
        adopterId: row.userId,
        petName: await petNameOf(row.petId),
        type,
        slotCount: proposedSlots.length,
      })
      return row
    })
    res.json(await withReceivedRequest(updated, viewer.id))
  },
)

organizationRouter.post('/me/received-requests/:id/interview/complete', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  if (!requirePermission(req, res, 'requests:review')) return
  const request = await receivedRequestOf(req, viewer.id)
  if (!request) return sendError(res, 404, 'Solicitação não encontrada')

  const interview = asRecord(request.interview)
  if (!interview) {
    return sendError(res, 400, 'Nenhuma entrevista foi agendada para esta solicitação.')
  }
  const statusCode = requestStatusCodeOf(request.status)
  if (statusCode !== 'ANALISE_QUESTIONARIO' && statusCode !== 'APROVADA') {
    return sendError(res, 409, 'Esta solicitação não está em etapa de entrevista.')
  }
  const completedAt = new Date().toISOString()
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.adoptionRequest.update({
      where: { id: request.id },
      data: {
        interview: {
          ...interview,
          status: 'REALIZADA',
          completed: true,
          completedAt,
        },
      },
    })
    await enqueueDomainEvent(tx, APPOINTMENT_CONFIRMED, {
      requestId: row.id,
      adopterId: row.userId,
      petName: await petNameOf(row.petId),
      completedAt,
    })
    return row
  })
  res.json(await withReceivedRequest(updated, viewer.id))
})

organizationRouter.post(
  '/me/received-requests/:id/transitions',
  validate({ body: organizationTransitionSchema }),
  async (req, res) => {
    const viewer = await requireGuardian(req, res)
    if (!viewer) return
    const request = await receivedRequestOf(req, viewer.id)
    if (!request) return sendError(res, 404, 'Solicitação não encontrada')

    const { to, reason } = req.body as OrganizationTransitionPayload
    const target = ORGANIZATION_REQUEST_TRANSITIONS[to]
    if (!target) return sendError(res, 400, 'Transição não suportada')

    // Cada transição exige uma permissão diferente da matriz (#28/#RBAC).
    const permission =
      target === 'APROVADA'
        ? 'requests:approve'
        : target === 'RECUSADA'
          ? 'requests:reject'
          : 'requests:review'
    if (!requirePermission(req, res, permission)) return

    // #20 + #23: a rota antiga usa a tabela da FSM e, ao aprovar, formaliza a
    // adoção dentro da mesma transação da mudança de status.
    try {
      const { row } = await applyTransition({
        req,
        requestId: request.id,
        to: target,
        reason,
        onTransition:
          target === 'APROVADA'
            ? async ({ tx }) => {
                const pet = await tx.pet.findUnique({ where: { id: request.petId } })
                if (!pet) throw new HttpError(404, 'Pet não encontrado')
                if (pet.status !== 'DISPONIVEL') {
                  throw new HttpError(409, 'Este pet não está mais disponível para adoção')
                }

                const membership = await tx.membership.findFirst({
                  where: { userId: viewer.id, organizationId: pet.organizationId, status: 'ATIVO' },
                })
                if (!membership) {
                  throw new HttpError(403, 'Você não é membro ativo desta organização')
                }
                if (membership.role !== 'ADMIN') {
                  throw new HttpError(403, 'Apenas administradores podem aprovar adoções')
                }

                await tx.adoption.create({
                  data: {
                    requestId: request.id,
                    petId: request.petId,
                    adopterId: request.userId,
                    organizationId: pet.organizationId,
                  },
                })
                await tx.pet.update({
                  where: { id: request.petId },
                  data: { status: 'ADOTADO' },
                })
              }
            : undefined,
      })
      res.json(await withReceivedRequest(row, viewer.id))
    } catch (error) {
      if (isUniqueViolation(error)) {
        return sendError(res, 409, 'Este pet já possui uma adoção')
      }
      throw error
    }
  },
)
