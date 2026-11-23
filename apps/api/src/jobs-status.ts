import 'dotenv/config'
import { PgBoss } from 'pg-boss'
import { prisma } from './db.js'

/** CLI de inspeção da fila: `npm run jobs:status`. */
const errorMessage = (output: object | null | undefined): string => {
  if (!output) return '—'
  const message = (output as { message?: unknown }).message
  return typeof message === 'string' ? message : JSON.stringify(output)
}

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim()
  const schema = process.env.PG_BOSS_SCHEMA?.trim() || 'pgboss'
  if (!connectionString) throw new Error('DATABASE_URL não definida (configure apps/api/.env)')

  const [installed] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = ${schema} AND table_name = 'version'
    ) AS exists
  `
  if (!installed?.exists) {
    console.log(`[jobs] schema "${schema}" não instalado — rode npm run db:deploy.`)
    await prisma.$disconnect()
    return
  }

  const boss = new PgBoss({ connectionString, schema })
  await boss.start()
  try {
    const queues = await boss.getQueues()
    console.log(`[jobs] filas (${queues.length}):`)
    if (queues.length === 0) {
      console.log('  (nenhuma — a API ainda não subiu com JOBS_ENABLED=true)')
    }
    for (const queue of queues) {
      console.log(
        `  ${queue.name}: total=${queue.totalCount} na fila=${queue.queuedCount} ` +
          `ativos=${queue.activeCount} falhados=${queue.failedCount} ` +
          `retryLimit=${queue.retryLimit} deadLetter=${queue.deadLetter ?? '-'}`,
      )
    }

    const schedules = await boss.getSchedules()
    console.log(`[jobs] agendamentos (${schedules.length}):`)
    for (const schedule of schedules) {
      console.log(
        `  ${schedule.name}: ${schedule.cron} (${schedule.timezone})${schedule.lastJobId ? ` último=${schedule.lastJobId}` : ''}`,
      )
    }

    const pending = await prisma.eventOutbox.count({ where: { processedAt: null } })
    console.log(`[jobs] eventos pendentes no outbox: ${pending}`)

    let problems = 0
    for (const queue of queues) {
      const jobs = await boss.findJobs(queue.name, { limit: 1000 })
      for (const job of jobs.filter((item) => item.state === 'failed' || item.state === 'retry')) {
        problems += 1
        const source = job.sourceName ? ` origem=${job.sourceName}` : ''
        const error = job.sourceOutput
          ? errorMessage(job.sourceOutput)
          : errorMessage(job.output as object | null)
        console.log(
          `  [${job.state}] ${job.name}${source} id=${job.id} ` +
            `tentativa=${job.retryCount}/${job.retryLimit} erro=${error}`,
        )
      }
    }
    console.log(`[jobs] jobs em falha/retentativa: ${problems}`)
    if (problems > 0) console.log('[jobs] após corrigir a causa, rode npm run jobs:redrive')
  } finally {
    await boss.stop()
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
