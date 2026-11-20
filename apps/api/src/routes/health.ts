import { Router } from 'express'
import { prisma } from '../db.js'

/** Checagem real: uma consulta trivial prova que a conexão com o banco está viva. */
export async function databaseIsAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

/** `checkDatabase` é injetável para os testes de 200/503 sem derrubar o banco. */
export function createHealthRouter(checkDatabase: () => Promise<boolean> = databaseIsAvailable) {
  const router = Router()

  router.get('/health', async (_req, res) => {
    if (await checkDatabase()) {
      return res.json({ status: 'ok', database: 'ok' })
    }
    return res.status(503).json({ status: 'error', database: 'unavailable' })
  })

  return router
}

export const healthRouter = createHealthRouter()
