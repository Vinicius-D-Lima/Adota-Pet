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
import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import {
  currentUser,
  demoRole,
  isChatParticipant,
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
import {
  APPOINTMENT_CONFIRMED,
  APPOINTMENT_PROPOSED,
  APPOINTMENT_RESCHEDULE_REQUESTED,
  enqueueDomainEvent,
} from '../events.js'
import { Prisma, type Appointment } from '../generated/prisma/client.js'
import { HttpError, list, sendError } from '../http.js'
import { petMedicalInclude } from '../medicalRecords.js'
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

/*
 * Agendamento de entrevista/visita (#21). Os valores gravados no banco são
 * Strings; o contrato abaio é a fonte única de validação das rotas e da OpenAPI.
 */
const APPOINTMENT_TYPES = ['ENTREVISTA', 'VISITA_DOMICILIAR'] as const
const APPOINTMENT_STATUSES = [
  'PROPOSTO',
  'CONFIRMADO',
  'REMARCACAO_SOLICITADA',
  'CANCELADO',
  'REALIZADO',
] as const

type AppointmentType = (typeof APPOINTMENT_TYPES)[number]
type AppointmentProposeBody = {
  type: AppointmentType
  proposedSlots: string[]
  location?: string
  notes?: string
}
type AppointmentRescheduleBody = { proposedSlots?: string[]; notes?: string }

/** ISO 8601 com data válida. A normalização para UTC acontece no handler. */
const isoUtc = z
  .string()
  .trim()
  .min(1, 'Informe o horário.')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Informe uma data ISO 8601 válida.')
const futureIsoSlot = isoUtc.refine(
  (value) => new Date(value).getTime() > Date.now(),
  'Todos os horários precisam ser datas futuras.',
)
/** ISO 8601 em UTC: o formato gravado no banco e devolvido na API (#21/AGD-08). */
const asUtc = (value: string) => new Date(value).toISOString()
const proposedSlotsSchema = z
  .array(futureIsoSlot)
  .min(1, 'Proponha de 1 a 3 horários.')
  .max(3, 'Proponha no máximo 3 horários.')

export const appointmentProposeBodySchema = z.strictObject({
  type: z.enum(APPOINTMENT_TYPES),
  proposedSlots: proposedSlotsSchema,
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
})
export const appointmentConfirmBodySchema = z.strictObject({ confirmedAt: isoUtc })
export const appointmentRescheduleBodySchema = z.strictObject({
  proposedSlots: proposedSlotsSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
})
const requestIdParamsSchema = z.strictObject({ id: z.string().min(1) })
export const appointmentParamsSchema = z.strictObject({
  id: z.string().min(1),
  appointmentId: z.string().min(1),
})
export const appointmentSchema = z.strictObject({
  id: z.string().min(1),
  requestId: z.string().min(1),
  type: z.enum(APPOINTMENT_TYPES),
  proposedSlots: z.array(z.string()),
  confirmedAt: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(APPOINTMENT_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export const appointmentListSchema = z.strictObject({
  data: z.array(appointmentSchema),
  total: z.number().int().nonnegative(),
})

/** Relógio injetável: AGD-04 testa a realização antes da data confirmada. */
export const appointmentClock = { now: () => new Date() }

const presentAppointment = (appointment: Appointment) =>
  appointmentSchema.parse({
    id: appointment.id,
    requestId: appointment.requestId,
    type: appointment.type,
    proposedSlots: appointment.proposedSlots,
    confirmedAt: appointment.confirmedAt?.toISOString() ?? null,
    location: appointment.location ?? null,
    notes: appointment.notes ?? null,
    status: appointment.status,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  })

const petForAppointment = async (petId: string) => {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { name: true, organizationEntity: { select: { name: true } } },
  })
  return { name: pet?.name ?? 'pet', organization: pet?.organizationEntity.name ?? 'Instituição' }
}

/** ENTREVISTA pode sair de ANALISE_QUESTIONARIO; VISITA só da sua própria etapa. */
const appointmentAllowed = (status: string | undefined, type: AppointmentType) => {
  if (type === 'ENTREVISTA') {
    return status === 'ANALISE_QUESTIONARIO' || status === 'ENTREVISTA'
  }
  return status === 'VISITA_DOMICILIAR'
}

async function managedRequestOrError(req: Request, res: Response, viewerId: string) {
  const request = await receivedRequestOf(req, viewerId)
  if (request) return request
  const exists = await prisma.adoptionRequest.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true },
  })
  sendError(
    res,
    exists ? 403 : 404,
    exists ? 'Você não tem acesso a esta solicitação' : 'Solicitação não encontrada',
  )
  return null
}

async function participantRequestOrError(req: Request, res: Response, viewerId: string) {
  const request = await prisma.adoptionRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!request) {
    sendError(res, 404, 'Solicitação não encontrada')
    return null
  }
  if (!(await isChatParticipant(request, viewerId))) {
    sendError(res, 403, 'Você não tem acesso a esta solicitação')
    return null
  }
  return request
}

async function appointmentOrError(req: Request, res: Response, requestId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: String(req.params.appointmentId), requestId },
  })
  if (!appointment) {
    sendError(res, 404, 'Agendamento não encontrado')
    return null
  }
  return appointment
}

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

  const pet = await prisma.$transaction(async (tx) => {
    const created = await tx.pet.create({ data: data as Prisma.PetUncheckedCreateInput })
    await tx.medicalRecord.create({
      data: {
        petId: created.id,
        createdById: viewer.id,
        updatedById: viewer.id,
        neutering: {
          create: { done: false, createdById: viewer.id, updatedById: viewer.id },
        },
      },
    })
    return tx.pet.findUniqueOrThrow({ where: { id: created.id }, include: petMedicalInclude })
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
    include: petMedicalInclude,
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
    include: petMedicalInclude,
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
  '/me/received-requests/:id/appointments',
  validate({ params: requestIdParamsSchema, body: appointmentProposeBodySchema }),
  async (req, res) => {
    const viewer = await requireGuardian(req, res)
    if (!viewer) return
    if (!requirePermission(req, res, 'requests:review')) return
    const request = await managedRequestOrError(req, res, viewer.id)
    if (!request) return

    const { type, proposedSlots, location, notes } = req.body as AppointmentProposeBody
    const slots = proposedSlots.map(asUtc)
    if (!appointmentAllowed(requestStatusCodeOf(request.status), type)) {
      return sendError(
        res,
        409,
        type === 'ENTREVISTA'
          ? 'Só é possível propor uma entrevista com a solicitação em análise ou entrevista.'
          : 'Só é possível propor uma visita com a solicitação em visita domiciliar.',
      )
    }

    const pet = await petForAppointment(request.petId)
    const appointment = await prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          requestId: request.id,
          type,
          proposedSlots: slots,
          location,
          notes,
          status: 'PROPOSTO',
        },
      })
      await enqueueDomainEvent(tx, APPOINTMENT_PROPOSED, {
        requestId: request.id,
        adopterId: request.userId,
        petName: pet.name,
        type,
        slotCount: slots.length,
      })
      return created
    })
    res.status(201).json(presentAppointment(appointment))
  },
)

organizationRouter.get(
  '/requests/:id/appointments',
  validate({ params: requestIdParamsSchema }),
  async (req, res) => {
    const { id: viewerId } = await currentUser(req)
    const request = await participantRequestOrError(req, res, viewerId)
    if (!request) return
    const appointments = await prisma.appointment.findMany({
      where: { requestId: request.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    res.json(list(appointments.map(presentAppointment)))
  },
)

organizationRouter.post(
  '/requests/:id/appointments/:appointmentId/confirm',
  validate({ params: appointmentParamsSchema, body: appointmentConfirmBodySchema }),
  async (req, res) => {
    const { id: viewerId } = await currentUser(req)
    const request = await participantRequestOrError(req, res, viewerId)
    if (!request) return
    if (request.userId !== viewerId) {
      return sendError(res, 403, 'Somente o adotante pode confirmar um agendamento')
    }
    const appointment = await appointmentOrError(req, res, request.id)
    if (!appointment) return
    if (appointment.status !== 'PROPOSTO') {
      return sendError(res, 409, 'Este agendamento não está aguardando confirmação')
    }

    const confirmedAt = asUtc(req.body.confirmedAt)
    if (!appointment.proposedSlots.includes(confirmedAt)) {
      return sendError(res, 400, 'O horário confirmado deve ser um dos horários propostos', [
        { field: 'confirmedAt', message: 'Escolha um dos horários propostos' },
      ])
    }

    const pet = await petForAppointment(request.petId)
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CONFIRMADO', confirmedAt: new Date(confirmedAt) },
      })
      await enqueueDomainEvent(tx, APPOINTMENT_CONFIRMED, {
        requestId: request.id,
        adopterId: request.userId,
        petName: pet.name,
        completedAt: confirmedAt,
      })
      return row
    })
    res.json(presentAppointment(updated))
  },
)

organizationRouter.post(
  '/requests/:id/appointments/:appointmentId/reschedule',
  validate({ params: appointmentParamsSchema, body: appointmentRescheduleBodySchema }),
  async (req, res) => {
    const { id: viewerId } = await currentUser(req)
    const request = await participantRequestOrError(req, res, viewerId)
    if (!request) return
    const appointment = await appointmentOrError(req, res, request.id)
    if (!appointment) return

    const body = req.body as AppointmentRescheduleBody
    const slots = body.proposedSlots?.map(asUtc)
    const isAdopter = request.userId === viewerId
    if (!isAdopter && !requirePermission(req, res, 'requests:review')) return
    if (isAdopter && body.proposedSlots) {
      return sendError(res, 403, 'Somente o responsável pode propor novos horários')
    }
    if (!isAdopter && !body.proposedSlots) {
      return sendError(res, 400, 'Informe de 1 a 3 novos horários', [
        { field: 'proposedSlots', message: 'Proponha de 1 a 3 horários' },
      ])
    }
    if (appointment.status === 'REALIZADO' || appointment.status === 'CANCELADO') {
      return sendError(res, 409, 'Este agendamento já foi encerrado')
    }
    if (isAdopter && appointment.status !== 'CONFIRMADO') {
      return sendError(res, 409, 'Só é possível pedir remarcação de um agendamento confirmado')
    }

    const pet = await petForAppointment(request.petId)
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.appointment.update({
        where: { id: appointment.id },
        data: isAdopter
          ? {
              status: 'REMARCACAO_SOLICITADA',
              confirmedAt: null,
              notes: body.notes ?? appointment.notes,
            }
          : {
              status: 'PROPOSTO',
              proposedSlots: slots ?? appointment.proposedSlots,
              confirmedAt: null,
              notes: body.notes ?? appointment.notes,
            },
      })
      if (isAdopter) {
        await enqueueDomainEvent(tx, APPOINTMENT_RESCHEDULE_REQUESTED, {
          requestId: request.id,
          adopterId: request.userId,
          petName: pet.name,
          organization: pet.organization,
          type: appointment.type,
        })
      } else {
        await enqueueDomainEvent(tx, APPOINTMENT_PROPOSED, {
          requestId: request.id,
          adopterId: request.userId,
          petName: pet.name,
          type: appointment.type,
          slotCount: (slots ?? appointment.proposedSlots).length,
        })
      }
      return row
    })
    res.json(presentAppointment(updated))
  },
)

organizationRouter.post(
  '/me/received-requests/:id/appointments/:appointmentId/complete',
  validate({ params: appointmentParamsSchema }),
  async (req, res) => {
    const viewer = await requireGuardian(req, res)
    if (!viewer) return
    if (!requirePermission(req, res, 'requests:review')) return
    const request = await managedRequestOrError(req, res, viewer.id)
    if (!request) return
    const appointment = await appointmentOrError(req, res, request.id)
    if (!appointment) return
    if (appointment.status !== 'CONFIRMADO' || !appointment.confirmedAt) {
      return sendError(res, 409, 'O agendamento precisa estar confirmado para ser realizado')
    }

    const now = appointmentClock.now()
    if (now.getTime() < appointment.confirmedAt.getTime()) {
      return sendError(res, 400, 'A data confirmada ainda não chegou', [
        { field: 'confirmedAt', message: 'Não é possível marcar como realizado antes da data' },
      ])
    }
    const completedAt = now.toISOString()
    const interview = {
      ...(asRecord(request.interview) ?? {}),
      type: appointment.type === 'ENTREVISTA' ? 'Entrevista online' : 'Visita presencial',
      proposedSlots: appointment.proposedSlots,
      status: 'REALIZADA',
      completed: true,
      scheduledAt: appointment.confirmedAt.toISOString(),
      completedAt,
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'REALIZADO' },
      })
      // FSM #20: a máquina lê `request.interview`, não a tabela de agendamentos.
      await tx.adoptionRequest.update({ where: { id: request.id }, data: { interview } })
      await enqueueDomainEvent(tx, APPOINTMENT_CONFIRMED, {
        requestId: request.id,
        adopterId: request.userId,
        petName: await petNameOf(request.petId),
        completedAt,
      })
      return row
    })
    res.json(presentAppointment(updated))
  },
)

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
