const formatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** Formata a data ISO da API em pt-BR; devolve o texto original se a data for inválida. */
export function formatRequestDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : formatter.format(date)
}
