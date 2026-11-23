import { Router } from 'express'
import { currentUser } from '../context.js'
import { generateFollowUpDueDates } from '../adoptions.js'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/client.js'
import { sendError } from '../http.js'
import { asRecord, validateFollowUpPlan } from '../validation.js'

export const adoptionsRouter = Router()

const adoptionView = {
  pet: true,
  plan: true,
  checkIns: { orderBy: { dueDate: 'asc' as const } },
} as const

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

async function activeMembership(userId: string, organizationId: string) {
  return prisma.membership.findFirst({
    where: { userId, organizationId, status: 'ATIVO' },
  })
}

function followUpPlanValues(body: Record<string, unknown>) {
  const { durationDays, intervalDays } = body
  if (typeof durationDays !== 'number' || typeof intervalDays !== 'number') return null
  return { durationDays, intervalDays }
}

adoptionsRouter.get('/me/adoptions', async (req, res) => {
  const { id: adopterId } = await currentUser(req)
  const data = await prisma.adoption.findMany({
    where: { adopterId },
    orderBy: [{ adoptedAt: 'desc' }, { id: 'asc' }],
    include: adoptionView,
  })
  res.json({ data, total: data.length })
})

adoptionsRouter.get('/organizations/:id/adoptions', async (req, res) => {
  const organization = await prisma.organization.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  })
  if (!organization) return sendError(res, 404, 'Organização não encontrada')

  const { id: userId } = await currentUser(req)
  if (!(await activeMembership(userId, organization.id))) {
    return sendError(res, 403, 'Você não é membro ativo desta organização')
  }

  const data = await prisma.adoption.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ adoptedAt: 'desc' }, { id: 'asc' }],
    include: adoptionView,
  })
  res.json({ data, total: data.length })
})

adoptionsRouter.post('/adoptions/:id/follow-up-plan', async (req, res) => {
  const details = validateFollowUpPlan(req.body)
  if (details.length) return sendError(res, 400, 'Plano de acompanhamento inválido', details)

  const body = asRecord(req.body)
  if (!body) return sendError(res, 400, 'Plano de acompanhamento inválido', details)
  const values = followUpPlanValues(body)
  if (!values) {
    return sendError(res, 400, 'Plano de acompanhamento inválido', [
      { field: 'body', message: 'durationDays e intervalDays devem ser números' },
    ])
  }

  const adoption = await prisma.adoption.findUnique({
    where: { id: req.params.id },
    select: { id: true, organizationId: true, adoptedAt: true },
  })
  if (!adoption) return sendError(res, 404, 'Adoção não encontrada')

  const { id: userId } = await currentUser(req)
  if (!(await activeMembership(userId, adoption.organizationId))) {
    return sendError(res, 403, 'Somente membros ativos da organização podem criar o plano')
  }

  const { durationDays, intervalDays } = values
  const dueDates = generateFollowUpDueDates(adoption.adoptedAt, durationDays, intervalDays)

  try {
    const plan = await prisma.$transaction(async (tx) => {
      if (await tx.followUpPlan.findUnique({ where: { adoptionId: adoption.id } })) return null

      await tx.followUpPlan.create({
        data: {
          adoptionId: adoption.id,
          durationDays,
          intervalDays,
          createdBy: userId,
        },
      })
      await tx.checkIn.createMany({
        data: dueDates.map((dueDate) => ({ adoptionId: adoption.id, dueDate })),
      })
      const created = await tx.followUpPlan.findUniqueOrThrow({
        where: { adoptionId: adoption.id },
      })
      const checkIns = await tx.checkIn.findMany({
        where: { adoptionId: adoption.id },
        orderBy: { dueDate: 'asc' },
      })
      return { ...created, checkIns }
    })
    if (!plan) return sendError(res, 409, 'Já existe um plano para esta adoção')
    res.status(201).json(plan)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return sendError(res, 409, 'Já existe um plano para esta adoção')
    }
    throw error
  }
})

adoptionsRouter.put('/adoptions/:id/follow-up-plan', async (req, res) => {
  const details = validateFollowUpPlan(req.body)
  if (details.length) return sendError(res, 400, 'Plano de acompanhamento inválido', details)

  const body = asRecord(req.body)
  if (!body) return sendError(res, 400, 'Plano de acompanhamento inválido', details)
  const values = followUpPlanValues(body)
  if (!values) {
    return sendError(res, 400, 'Plano de acompanhamento inválido', [
      { field: 'body', message: 'durationDays e intervalDays devem ser números' },
    ])
  }

  const adoption = await prisma.adoption.findUnique({
    where: { id: req.params.id },
    select: { id: true, organizationId: true, adoptedAt: true },
  })
  if (!adoption) return sendError(res, 404, 'Adoção não encontrada')

  const { id: userId } = await currentUser(req)
  if (!(await activeMembership(userId, adoption.organizationId))) {
    return sendError(res, 403, 'Somente membros ativos da organização podem editar o plano')
  }

  const { durationDays, intervalDays } = values
  const dueDates = generateFollowUpDueDates(adoption.adoptedAt, durationDays, intervalDays)

  const plan = await prisma.$transaction(async (tx) => {
    const existingPlan = await tx.followUpPlan.findUnique({
      where: { adoptionId: adoption.id },
    })
    if (!existingPlan) return null

    await tx.followUpPlan.update({
      where: { id: existingPlan.id },
      data: { durationDays, intervalDays },
    })

    const existingCheckIns = await tx.checkIn.findMany({
      where: { adoptionId: adoption.id },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    })
    const pending = existingCheckIns.filter(
      (checkIn) =>
        checkIn.status === 'PENDENTE' &&
        checkIn.submittedAt === null &&
        checkIn.reviewedAt === null,
    )
    const dueDateTimes = new Set(dueDates.map((dueDate) => dueDate.getTime()))
    const reusablePending = pending.filter(
      (checkIn) => !dueDateTimes.has(checkIn.dueDate.getTime()),
    )
    const retainedIds = new Set<string>()
    let reusableIndex = 0

    for (const dueDate of dueDates) {
      const existing = existingCheckIns.find(
        (checkIn) => checkIn.dueDate.getTime() === dueDate.getTime(),
      )
      if (existing) {
        retainedIds.add(existing.id)
        continue
      }

      const reusable = reusablePending[reusableIndex]
      if (reusable) {
        reusableIndex += 1
        retainedIds.add(reusable.id)
        await tx.checkIn.update({
          where: { id: reusable.id },
          data: { dueDate },
        })
      } else {
        await tx.checkIn.create({
          data: { adoptionId: adoption.id, dueDate },
        })
      }
    }

    const obsoletePending = pending.filter(({ id }) => !retainedIds.has(id))
    if (obsoletePending.length) {
      await tx.checkIn.deleteMany({
        where: { id: { in: obsoletePending.map(({ id }) => id) } },
      })
    }

    const remainingCount = await tx.checkIn.count({
      where: { adoptionId: adoption.id, status: { not: 'REVISADO' } },
    })
    const updated = await tx.followUpPlan.update({
      where: { id: existingPlan.id },
      data: { completedAt: remainingCount === 0 ? existingPlan.completedAt : null },
    })
    const checkIns = await tx.checkIn.findMany({
      where: { adoptionId: adoption.id },
      orderBy: { dueDate: 'asc' },
    })
    return { ...updated, checkIns }
  })

  if (!plan) return sendError(res, 404, 'Plano de acompanhamento não encontrado')
  res.json(plan)
})
