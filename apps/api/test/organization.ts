import { prisma } from '../src/db.js'

/** Organização mínima para factories de Pet após a migração para FK (#27). */
export function ensureTestOrganization(name: string, initials?: string) {
  return prisma.organization.upsert({
    where: { name },
    update: {},
    create: {
      name,
      initials: initials ?? name.slice(0, 2).toUpperCase(),
    },
  })
}
