export function getInternalNotificationPath(link: string): string | null {
  if (!link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null

  try {
    const target = new URL(link, window.location.origin)
    if (target.origin !== window.location.origin) return null
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return null
  }
}
