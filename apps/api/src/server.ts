import { createApp } from './app.js'
import { ConfigError, loadConfig } from './config.js'
import { logger } from './logger.js'
import { prisma } from './db.js'
import { processCheckInDeadlines } from './checkIns.js'
import { processDailyDigest, QUEUES, registerJobHandler, startJobs, stopJobs } from './jobs.js'

registerJobHandler(QUEUES.checkInOverdue, () => processCheckInDeadlines())
registerJobHandler(QUEUES.dailyDigest, () => processDailyDigest())

async function main() {
  // INF-01: sem variável obrigatória, morre aqui — antes de abrir a porta.
  const config = loadConfig()
  await startJobs({
    connectionString: config.DATABASE_URL,
    schema: config.PG_BOSS_SCHEMA,
    enabled: config.JOBS_ENABLED,
    shutdownTimeoutMs: config.JOBS_SHUTDOWN_TIMEOUT_MS,
    logger,
  })

  const server = createApp().listen(config.PORT, () => {
    logger.info({ port: config.PORT, environment: config.NODE_ENV }, 'API pronta')
  })

  let shuttingDown = false
  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'encerrando API')
    server.close(async () => {
      try {
        await stopJobs()
        await prisma.$disconnect()
      } finally {
        process.exit(0)
      }
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
  if (error instanceof ConfigError) {
    console.error(error.message)
  } else {
    console.error(error)
  }
  process.exitCode = 1
})
