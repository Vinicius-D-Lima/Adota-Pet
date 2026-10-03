const ignoredNameParts = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function getInitials(name: string): string {
  const nameParts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part && !ignoredNameParts.has(part.toLocaleLowerCase('pt-BR')))

  if (nameParts.length === 0) return '?'

  return nameParts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase('pt-BR')
}
