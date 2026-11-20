import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

/**
 * Cliente Prisma compartilhado (instância única por processo).
 * Requer `DATABASE_URL` (veja `apps/api/.env.example`).
 *
 * Uso: `import { prisma } from './db.js'` e `await prisma.$disconnect()`
 * ao encerrar o processo.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' })

export const prisma = new PrismaClient({ adapter })
