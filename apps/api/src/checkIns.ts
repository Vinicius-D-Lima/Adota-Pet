import { completeFollowUpPlanIfReviewed } from './adoptions.js'
import { prisma } from './db.js'
import { CHECK_IN_DUE, CHECK_IN_OVERDUE, CHECK_IN_REVIEWED, enqueueDomainEvent } from './events.js'
import type { Prisma } from './generated/prisma/client.js'

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function eventPetName(name: string): string {
  return name.slice(0, 200) || 'pet'
}

/**
 * Publica lembretes do dia e marca como atrasados os check-ins pendentes de
 * dias anteriores. O estado e os eventos são persistidos na mesma transação.
 */
export async function processCheckInDeadlines(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Data de referência inválida')

  const today = utcDayStart(now)
  const tomorrow = new Date(today.getTime() + DAY_IN_MILLISECONDS)
  const dueCheckIns = await prisma.checkIn.findMany({
    where: { status: 'PENDENTE', dueDate: { gte: today, lt: tomorrow } },
    select: {
      id: true,
      dueDate: true,
      adoption: {
        select: {
          adopterId: true,
          pet: { select: { name: true } },
        },
      },
    },
  })

  let due = 0
  for (const checkIn of dueCheckIns) {
    const recorded = await prisma.$transaction(async (tx) => {
      // Conditional update serializes this with a concurrent check-in submission.
      const current = await tx.checkIn.updateMany({
        where: { id: checkIn.id, status: 'PENDENTE', dueDate: { gte: today, lt: tomorrow } },
        data: { status: 'PENDENTE' },
      })
      if (current.count !== 1) return false

      const effect = await tx.jobEffect.createMany({
        data: [{ eventId: `${CHECK_IN_DUE}:${checkIn.id}`, type: CHECK_IN_DUE }],
        skipDuplicates: true,
      })
      if (effect.count === 0) return false

      await enqueueDomainEvent(tx, CHECK_IN_DUE, {
        checkInId: checkIn.id,
        adopterId: checkIn.adoption.adopterId,
        petName: eventPetName(checkIn.adoption.pet.name),
        dueAt: checkIn.dueDate.toISOString(),
      })
      return true
    })
    if (recorded) due += 1
  }

  const overdueCheckIns = await prisma.checkIn.findMany({
    where: { status: 'PENDENTE', dueDate: { lt: today } },
    select: {
      id: true,
      dueDate: true,
      adoption: {
        select: {
          adopterId: true,
          pet: { select: { name: true } },
        },
      },
    },
  })

  let overdue = 0
  for (const checkIn of overdueCheckIns) {
    const marked = await prisma.$transaction(async (tx) => {
      const changed = await tx.checkIn.updateMany({
        where: { id: checkIn.id, status: 'PENDENTE', dueDate: { lt: today } },
        data: { status: 'ATRASADO' },
      })
      if (changed.count !== 1) return false

      await enqueueDomainEvent(tx, CHECK_IN_OVERDUE, {
        checkInId: checkIn.id,
        adopterId: checkIn.adoption.adopterId,
        petName: eventPetName(checkIn.adoption.pet.name),
        dueAt: checkIn.dueDate.toISOString(),
      })
      return true
    })
    if (marked) overdue += 1
  }

  return { due, overdue }
}

export async function recordCheckInReview(
  tx: Prisma.TransactionClient,
  input: {
    adoptionId: string
    checkInId: string
    adopterId: string
    petName: string
    status: 'REVISADO' | 'PENDENTE'
  },
) {
  await enqueueDomainEvent(tx, CHECK_IN_REVIEWED, {
    checkInId: input.checkInId,
    adopterId: input.adopterId,
    petName: eventPetName(input.petName),
    status: input.status,
  })
  if (input.status === 'REVISADO') {
    await completeFollowUpPlanIfReviewed(tx, input.adoptionId)
  }
}
