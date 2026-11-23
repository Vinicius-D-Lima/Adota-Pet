import type { Prisma } from './generated/prisma/client.js'

export const MAX_FOLLOW_UP_DURATION_DAYS = 3650

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

export function generateFollowUpDueDates(
  adoptedAt: Date,
  durationDays: number,
  intervalDays: number,
): Date[] {
  if (
    !Number.isSafeInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > MAX_FOLLOW_UP_DURATION_DAYS ||
    !Number.isSafeInteger(intervalDays) ||
    intervalDays < 1 ||
    intervalDays > durationDays
  ) {
    throw new RangeError('Duração e intervalo do plano são inválidos')
  }

  const start = Date.UTC(
    adoptedAt.getUTCFullYear(),
    adoptedAt.getUTCMonth(),
    adoptedAt.getUTCDate(),
  )
  const dates: Date[] = []
  for (let day = intervalDays; day <= durationDays; day += intervalDays) {
    dates.push(new Date(start + day * DAY_IN_MILLISECONDS))
  }
  return dates
}

export async function completeFollowUpPlanIfReviewed(
  tx: Prisma.TransactionClient,
  adoptionId: string,
): Promise<void> {
  const remaining = await tx.checkIn.count({
    where: { adoptionId, status: { not: 'REVISADO' } },
  })
  if (remaining > 0) return

  await tx.followUpPlan.updateMany({
    where: { adoptionId, completedAt: null },
    data: { completedAt: new Date() },
  })
}
