import { createApp } from './app.js'
import { ConfigError, loadConfig } from './config.js'
import { logger } from './logger.js'
import { prisma } from './db.js'

try {
  // INF-01: sem variável obrigatória, morre aqui — antes de abrir a porta.
  const config = loadConfig()
  const server = createApp().listen(config.PORT, () => {
    logger.info({ port: config.PORT, environment: config.NODE_ENV }, 'API pronta')
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'encerrando API')
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message)
  } else {
    console.error(error)
  }
  process.exitCode = 1
}
