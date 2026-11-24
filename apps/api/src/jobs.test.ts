import { TestClock } from 'pg-boss'
import { z } from 'zod'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { prisma } from './db.js'
import { newRequestEventSchema } from './events.js'
import {
  QUEUES,
  clearJobHandlers,
  createJobRunner,
  enqueueJob,
  registerJobHandler,
  registerTypedWorker,
  runOnce,
  type JobRunner,
} from './jobs.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const connectionString = process.env.DATABASE_URL ?? ''

databaseSuite('fila de jobs (pg-boss)', () => {
  let runner: JobRunner

  beforeAll(async () => {
    runner = createJobRunner({
      connectionString,
      spies: true,
      pollingIntervalSeconds: 0.5,
      shutdownTimeoutMs: 5_000,
    })
    await runner.start()
  })

  afterAll(async () => {
    await runner.stop()
  })

  beforeEach(async () => {
    await resetTestDatabase()
  })

  afterEach(async () => {
    clearJobHandlers()
    await runner.boss.deleteAllJobs()
    runner.boss.clearSpies()
    await resetTestDatabase()
  })

  it('[JOB-01] pg-boss inicia e cria seu schema pela migration em banco vazio', async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'pgboss'
    `
    expect(tables.map((row) => row.table_name)).toContain('version')
    expect(await runner.boss.isInstalled()).toBe(true)
    expect(await runner.boss.schemaVersion()).toBeGreaterThan(0)
  })

  it('[JOB-02] job executado e concluído', async () => {
    const queue = 'test-basic'
    const schema = z.strictObject({ orderId: z.string() })
    let received = ''

    await registerTypedWorker(
      runner.boss,
      queue,
      schema,
      async (payload) => {
        received = payload.orderId
        return { received: payload.orderId }
      },
      { pollingIntervalSeconds: 0.5, retryLimit: 0 },
    )

    const spy = runner.boss.getSpy<{ orderId: string }>(queue)
    const id = await enqueueJob(runner.boss, queue, { orderId: 'pedido-1' }, { retryLimit: 0 })
    expect(id).toBeTruthy()

    const job = await spy.waitForJobWithId(id!, 'completed')
    expect(job.output).toEqual({ received: 'pedido-1' })
    expect(received).toBe('pedido-1')
  })

  it('[JOB-03] falha gera retentativa e dead letter', async () => {
    const queue = 'test-retry'
    await registerTypedWorker(
      runner.boss,
      queue,
      z.strictObject({ attempt: z.number() }),
      async () => {
        throw new Error('falha permanente')
      },
      { pollingIntervalSeconds: 0.5, retryLimit: 1, retryDelay: 1, retryBackoff: true },
    )

    const spy = runner.boss.getSpy(queue)
    const id = await enqueueJob(runner.boss, queue, { attempt: 1 }, { retryLimit: 1 })
    const failed = await spy.waitForJobWithId(id!, 'failed')
    expect(failed.output).toMatchObject({ message: 'falha permanente' })

    await vi.waitFor(
      async () => {
        const dead = await runner.boss.findJobs(QUEUES.deadLetter)
        expect(dead.some((job) => job.sourceName === queue && job.sourceId === id)).toBe(true)
      },
      { timeout: 10_000 },
    )
  })

  it('[JOB-04] mesmo evento duas vezes produz um só efeito', async () => {
    const queue = 'test-idempotent'
    const payload = { eventId: 'evt-1', value: 1 }
    let effects = 0

    await registerTypedWorker(
      runner.boss,
      queue,
      z.strictObject({ eventId: z.string(), value: z.number() }),
      async (event) => {
        await runOnce(event.eventId, queue, async () => {
          effects += 1
        })
        return { effects }
      },
      { pollingIntervalSeconds: 0.5, retryLimit: 0 },
    )

    const spy = runner.boss.getSpy(queue)
    const first = await enqueueJob(runner.boss, queue, payload, {
      singletonKey: payload.eventId,
      retryLimit: 0,
    })
    const second = await enqueueJob(
      runner.boss,
      queue,
      { ...payload, value: 2 },
      {
        singletonKey: payload.eventId,
        retryLimit: 0,
      },
    )
    expect(first).toBeTruthy()
    expect(second).toBeNull()

    await spy.waitForJobWithId(first!, 'completed')
    // Simula uma redelivery: o ledger barra o segundo efeito.
    await runOnce(payload.eventId, queue, async () => {
      effects += 1
    })
    expect(effects).toBe(1)
  })

  it('[JOB-05] job agendado dispara no horário com relógio simulado', async () => {
    // Schema descartado no início: um cron_on de execução anterior (com outro
    // relógio) faria o timekeeper ignorar o novo horário simulado.
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "pgboss_clock_test" CASCADE')
    const base = new Date(Date.now() + 86_400_000)
    base.setUTCHours(7, 59, 50, 0)
    const clock = new TestClock(base)
    const clockRunner = createJobRunner({
      connectionString,
      schema: 'pgboss_clock_test',
      clock,
      spies: true,
      pollingIntervalSeconds: 0.5,
      shutdownTimeoutMs: 5_000,
    })
    let fired = 0
    registerJobHandler(QUEUES.checkInOverdue, async () => {
      fired += 1
    })

    await clockRunner.start()
    try {
      await clock.setTime(base.getTime() + 15_000)
      await clock.tick(31_000)
      await vi.waitFor(
        async () => {
          const jobs = await prisma.$queryRawUnsafe<Array<{ state: string }>>(
            'SELECT state FROM "pgboss_clock_test".job WHERE name = $1',
            QUEUES.checkInOverdue,
          )
          expect(jobs.some((job) => job.state === 'completed')).toBe(true)
        },
        { timeout: 10_000 },
      )
      expect(fired).toBe(1)
    } finally {
      await clockRunner.stop()
      await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "pgboss_clock_test" CASCADE')
    }
  })

  it('[JOB-06] payload sem dados sensíveis e validado com Zod', async () => {
    const safe = {
      requestId: 'SOL-1043',
      petId: 'pet-1',
      adopterId: 'user-1',
      organization: 'ONG Amigo',
      createdAt: new Date().toISOString(),
    }

    expect(newRequestEventSchema.parse(safe)).toEqual(safe)
    expect(JSON.stringify(safe)).not.toMatch(/password|token|cpf|secret/i)
    expect(newRequestEventSchema.safeParse({ ...safe, password: '123' }).success).toBe(false)
    expect(newRequestEventSchema.safeParse({ ...safe, token: '123' }).success).toBe(false)

    const queue = 'test-sensitive'
    await registerTypedWorker(
      runner.boss,
      queue,
      newRequestEventSchema,
      async () => ({ ok: true }),
      {
        pollingIntervalSeconds: 0.5,
        retryLimit: 0,
      },
    )
    const spy = runner.boss.getSpy(queue)
    const id = await enqueueJob(
      runner.boss,
      queue,
      { ...safe, token: 'super-secreto' },
      { retryLimit: 0 },
    )
    const job = await spy.waitForJobWithId(id!, 'failed')
    expect(JSON.stringify(job.output ?? {})).not.toContain('super-secreto')
  })

  it('[JOB-07] transação desfeita não deixa o job; commit deixa', async () => {
    const queue = 'test-transactional'
    await runner.boss.createQueue(queue, { deadLetter: QUEUES.deadLetter, retryLimit: 0 })
    const before = (await runner.boss.findJobs(queue)).length

    await expect(
      prisma.$transaction(async (tx) => {
        await enqueueJob(runner.boss, queue, { should: 'not exist' }, { tx, retryLimit: 0 })
        throw new Error('desfazer')
      }),
    ).rejects.toThrow('desfazer')

    await prisma.$transaction(async (tx) => {
      await enqueueJob(runner.boss, queue, { should: 'exist' }, { tx, retryLimit: 0 })
    })

    await vi.waitFor(async () => {
      expect((await runner.boss.findJobs(queue)).length).toBe(before + 1)
    })
  })

  it('[JOB-08] encerramento gracioso espera o job em andamento', async () => {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "pgboss_shutdown_test" CASCADE')
    let finished = false
    const shutdownRunner = createJobRunner({
      connectionString,
      schema: 'pgboss_shutdown_test',
      spies: true,
      pollingIntervalSeconds: 0.5,
      shutdownTimeoutMs: 5_000,
    })
    await shutdownRunner.start()

    try {
      const queue = 'test-graceful'
      await shutdownRunner.boss.createQueue(queue, {
        deadLetter: QUEUES.deadLetter,
        retryLimit: 0,
      })
      await shutdownRunner.boss.work(queue, { pollingIntervalSeconds: 0.5 }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 600))
        finished = true
        return { done: true }
      })

      const spy = shutdownRunner.boss.getSpy(queue)
      const id = await enqueueJob(shutdownRunner.boss, queue, {}, { retryLimit: 0 })
      await spy.waitForJobWithId(id!, 'active')

      // Mesmo caminho chamado pelo SIGTERM em server.ts.
      await shutdownRunner.stop()
      expect(finished).toBe(true)
    } finally {
      await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "pgboss_shutdown_test" CASCADE')
    }
  })
})
