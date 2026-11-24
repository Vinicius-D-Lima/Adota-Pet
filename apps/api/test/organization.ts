import { prisma } from '../src/db.js'
import { Prisma } from '../src/generated/prisma/client.js'

/** Organização mínima para factories de Pet após a migração para FK (#27). */
export async function ensureTestOrganization(name: string, initials?: string) {
  const create = {
    name,
    initials: initials ?? name.slice(0, 2).toUpperCase(),
  }
  try {
    return await prisma.organization.upsert({
      where: { name },
      update: {},
      create,
    })
  } catch (error) {
    // Upserts concorrentes com o mesmo nome podem perder a corrida no Postgres.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.organization.findUnique({ where: { name } })
      if (existing) return existing
    }
    throw error
  }
}
