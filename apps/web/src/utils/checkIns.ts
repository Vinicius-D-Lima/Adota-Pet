import type { CheckIn } from '@adotapet/shared'

const statusOrder: Record<CheckIn['status'], number> = {
  ATRASADO: 0,
  PENDENTE: 1,
  ENVIADO: 2,
  REVISADO: 3,
}

export const isCheckInOverdue = (checkIn: CheckIn, now = new Date()) =>
  checkIn.status === 'ATRASADO' ||
  (checkIn.status === 'PENDENTE' && Date.parse(checkIn.dueDate) < now.getTime())

/** Atrasados primeiro, depois por data prevista — o destaque do #37 é visual e na ordem. */
export function sortCheckIns(checkIns: CheckIn[], now = new Date()) {
  return [...checkIns].sort((left, right) => {
    const byStatus = Number(isCheckInOverdue(right, now)) - Number(isCheckInOverdue(left, now))
    if (byStatus) return byStatus
    const byRank = statusOrder[left.status] - statusOrder[right.status]
    if (byRank) return byRank
    return Date.parse(left.dueDate) - Date.parse(right.dueDate)
  })
}

/** Enviados e revisados contam como "enviados" no progresso exibido ao adotante. */
export const sentCheckInCount = (checkIns: CheckIn[]) =>
  checkIns.filter(({ status }) => status === 'ENVIADO' || status === 'REVISADO').length
