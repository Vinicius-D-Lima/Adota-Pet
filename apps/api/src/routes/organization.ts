import {
  emptyRequestStageCounters,
  interviewApiSchema,
  organizationRequestStageOf,
  organizationTransitionSchema,
  receivedRequestsQuerySchema,
  rejectionFormSchema,
  type InterviewApiPayload,
  type OrganizationTransitionPayload,
  type ReceivedRequestsQuery,
} from '@adotapet/shared'
import type { Request } from 'express'
import { Router } from 'express'
import {
  demoRole,
  organizationIdentity,
  organizationPets,
  permissionsForRole,
  requireGuardian,
  requirePermission,
  withGallery,
  withReceivedRequest,
} from '../context.js'
import { prisma } from '../db.js'
import type { Pet, Prisma } from '../generated/prisma/client.js'
import { list, sendError, zodDetails } from '../http.js'
import { deleteStorageObjectsForResource } from '../storage.js'
import { validate } from '../validate.js'
import { ORGANIZATION_PET_FIELDS, asRecord, validateOrganizationPet } from '../validation.js'

export const organizationRouter = Router()

const ORGANIZATION_REQUEST_TRANSITIONS: Record<string, string> = {
  EM_ANALISE: 'Em análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
}
const presentOrganizationPet = (pet: Pet) => ({
  ...withGallery(pet),
  distance: null,
  distanceKm: null,
})

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

  const {
    name: organization,
    initials: organizationInitials,
    user,
  } = await organizationIdentity(viewer.id)
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
    organization,
    organizationInitials,
    lat: typeof user?.lat === 'number' ? user.lat : -23.5505,
    lng: typeof user?.lng === 'number' ? user.lng : -46.6333,
    createdAt: new Date(),
  }
  // Campos validados por ORGANIZATION_PET_FIELDS (o Prisma exige todos de uma vez).
  for (const key of ORGANIZATION_PET_FIELDS) Object.assign(data, { [key]: body[key] })

  const pet = await prisma.pet.create({ data: data as Prisma.PetUncheckedCreateInput })
  res.status(201).json(presentOrganizationPet(pet))
})

organizationRouter.put('/me/organization-pets/:id', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  const identity = await organizationIdentity(viewer.id)
  const existing = await prisma.pet.findFirst({
    where: { id: req.params.id, organization: identity.name },
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

  const updated = await prisma.pet.update({ where: { id: existing.id }, data })
  res.json(presentOrganizationPet(updated))
})

organizationRouter.delete('/me/organization-pets/:id', async (req, res) => {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return
  const identity = await organizationIdentity(viewer.id)
  const existing = await prisma.pet.findFirst({
    where: { id: req.params.id, organization: identity.name },
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
    organization: { id: viewer.id, name: identity.name, initials: identity.initials },
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
    if (request.status !== 'Em análise') {
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
    const updated = await prisma.adoptionRequest.update({
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
  if (!['Em análise', 'Aprovada'].includes(request.status)) {
    return sendError(res, 409, 'Esta solicitação não está em etapa de entrevista.')
  }
  const updated = await prisma.adoptionRequest.update({
    where: { id: request.id },
    data: {
      interview: {
        ...interview,
        status: 'REALIZADA',
        completed: true,
        completedAt: new Date().toISOString(),
      },
    },
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

    const { to, reason: bodyReason } = req.body as OrganizationTransitionPayload
    const status = ORGANIZATION_REQUEST_TRANSITIONS[to]
    if (!status) return sendError(res, 400, 'Transição não suportada')

    // Cada transição exige uma permissão diferente da matriz (#28/#RBAC).
    const permission =
      status === 'Aprovada'
        ? 'requests:approve'
        : status === 'Recusada'
          ? 'requests:reject'
          : 'requests:review'
    if (!requirePermission(req, res, permission)) return

    const interview = asRecord(request.interview)
    if (status === 'Aprovada' && interview?.completed !== true) {
      return sendError(
        res,
        400,
        'O agendamento da etapa precisa estar marcado como realizado antes de aprovar.',
        [{ field: 'interview', message: 'Marque a entrevista como realizada antes de aprovar.' }],
      )
    }

    const allowed =
      (request.status === 'Enviada' && ['Em análise', 'Recusada'].includes(status)) ||
      (request.status === 'Em análise' && ['Aprovada', 'Recusada'].includes(status))
    if (!allowed)
      return sendError(
        res,
        409,
        `Não é possível alterar uma solicitação com status "${request.status}" para "${status}"`,
      )

    const reason = bodyReason?.trim() ?? ''
    if (status === 'Recusada') {
      const parsedReason = rejectionFormSchema.safeParse({ reason })
      if (!parsedReason.success) {
        return sendError(res, 400, 'Informe o motivo da recusa', zodDetails(parsedReason.error))
      }
    }
    const messages: Record<string, string> = {
      'Em análise': 'A instituição iniciou a análise da sua solicitação.',
      Aprovada: 'Sua solicitação foi aprovada pela instituição.',
      Recusada: reason
        ? `A instituição encerrou esta solicitação: ${reason}`
        : 'A instituição encerrou esta solicitação.',
    }
    const updated = await prisma.adoptionRequest.update({
      where: { id: request.id },
      data: {
        status,
        message: messages[status],
        ...(status === 'Recusada' && reason ? { rejectionReason: reason } : {}),
      },
    })
    res.json(await withReceivedRequest(updated, viewer.id))
  },
)
