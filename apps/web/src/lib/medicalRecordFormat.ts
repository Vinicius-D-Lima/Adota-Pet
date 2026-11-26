export function formatMedicalDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function isOverdue(nextDoseAt?: string | null, now = Date.now()): boolean {
  return Boolean(nextDoseAt && new Date(nextDoseAt).getTime() < now)
}
