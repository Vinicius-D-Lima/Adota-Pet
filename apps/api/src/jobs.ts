import { PgBoss, fromPrisma } from 'pg-boss'
import type { Clock, Job, Queue, SendOptions, WorkOptions } from 'pg-boss'
import type { Logger } from 'pino'
import type { ZodType } from 'zod'
import { prisma } from './db.js'
import {
  domainEventSchemas,
  markEventProcessed,
  newRequestEventSchema,
  pendingEvents,
} from './events.js'
import type { Prisma } from './generated/prisma/client.js'
import { logger as defaultLogger } from './logger.js'

/**
 * Fila de jobs com pg-boss (#95 / épico #45).
 *
 * O schema do pg-boss já vem da migration; aqui só registramos filas, workers e
 * agendamentos. Eventos de domínio entram no `EventOutbox` na transação da
 * gravação (#50) e um worker os publica nas filas nomeadas pelo tipo do evento.
 */
export const QUEUES = {
  dispatch: 'outbox-dispatch',
  newRequest: 'NewRequestForOrganization',
  checkInOverdue: 'check-in-overdue',
  dailyDigest: 'daily-digest',
  deadLetter: 'jobs-dead-letter',
} as const

/** Cron em UTC: check-ins atrasados e resumo diário (#24 / #31). */
export const SCHEDULES = [
  { queue: QUEUES.checkInOverdue, cron: '0 8 * * *' },
  { queue: QUEUES.dailyDigest, cron: '0 7 * * *' },
] as const

/** O despachante do outbox roda de minuto em minuto. */
const DISPATCH_CRON = '* * * * *'

type QueueConfig = Omit<Queue, 'name'>

const RETRY_QUEUE: QueueConfig = {
  retryLimit: 3,
  retryDelay: 2,
  retryBackoff: true,
  deleteAfterSeconds: 86_400,
}

const DEFAULT_POLLING_SECONDS = 2
/** Dedupe na publicação: um evento (id do outbox) nunca gera dois jobs. */
const DEDUPE_WINDOW_SECONDS = 60 * 60 * 24 * 30

const toOutput = (result: unknown): object =>
  result && typeof result === 'object' ? result : { ok: true, result }

type JobHandler = (payload: unknown, job: Job<unknown>) => Promise<unknown> | unknown

const handlers = new Map<string, JobHandler>()

/** Hook para os consumidores de domínio (#30 registra o de nova solicitação). */
export function registerJobHandler(queue: string, handler: JobHandler): void {
  handlers.set(queue, handler)
}

export function clearJobHandlers(): void {
  handlers.clear()
}

/**
 * Idempotência por evento: a PK de `JobEffect` faz o `skipDuplicates` ser atômico.
 * Se o efeito falhar, a linha é removida para que a retentativa possa tentar de novo.
 */
export async function runOnce<T>(
  eventId: string,
  type: string,
  effect: () => Promise<T>,
): Promise<T | undefined> {
  const inserted = await prisma.jobEffect.createMany({
    data: [{ eventId, type }],
    skipDuplicates: true,
  })
  if (inserted.count === 0) return undefined

  try {
    return await effect()
  } catch (error) {
    await prisma.jobEffect.delete({ where: { eventId } })
    throw error
  }
}

export interface EnqueueOptions {
  /** Transação do Prisma: o job entra (e sai) junto com os dados (JOB-07). */
  tx?: Prisma.TransactionClient
  singletonKey?: string
  retryLimit?: number
}

function splitWorkerOptions(options: TypedWorkerOptions): {
  queueOptions: QueueConfig
  workOptions: WorkOptions
} {
  const { queueOptions, retryLimit, retryDelay, retryBackoff, ...workOptions } = options
  return {
    queueOptions: {
      ...RETRY_QUEUE,
      ...queueOptions,
      ...(retryLimit === undefined ? {} : { retryLimit }),
      ...(retryDelay === undefined ? {} : { retryDelay }),
      ...(retryBackoff === undefined ? {} : { retryBackoff }),
      deadLetter: QUEUES.deadLetter,
    },
    workOptions,
  }
}

export function enqueueJob(
  boss: PgBoss,
  name: string,
  data: object,
  options: EnqueueOptions = {},
): Promise<string | null> {
  const sendOptions: SendOptions = {
    deadLetter: QUEUES.deadLetter,
    retryLimit: options.retryLimit ?? RETRY_QUEUE.retryLimit,
    retryDelay: RETRY_QUEUE.retryDelay,
    retryBackoff: true,
  }
  if (options.singletonKey) {
    sendOptions.singletonKey = options.singletonKey
    sendOptions.singletonSeconds = DEDUPE_WINDOW_SECONDS
  }
  if (options.tx) sendOptions.db = fromPrisma(options.tx)

  return boss.send(name, data, sendOptions)
}

export interface TypedWorkerOptions extends WorkOptions {
  queueOptions?: QueueConfig
  retryLimit?: number
  retryDelay?: number
  retryBackoff?: boolean
}

/** Worker com payload validado por Zod antes de chegar ao handler. */
export async function registerTypedWorker<T>(
  boss: PgBoss,
  queue: string,
  schema: ZodType<T>,
  handler: (payload: T, job: Job<unknown>) => Promise<unknown> | unknown,
  options: TypedWorkerOptions = {},
) {
  const { queueOptions, workOptions } = splitWorkerOptions(options)
  await boss.createQueue(QUEUES.deadLetter)
  await boss.createQueue(queue, queueOptions)
  return boss.work(
    queue,
    { pollingIntervalSeconds: DEFAULT_POLLING_SECONDS, ...workOptions },
    async ([job]) => {
      const payload = schema.parse(job.data)
      return toOutput(await handler(payload, job))
    },
  )
}

/** Worker de schedule: recebe o job disparado pelo cron (payload vazio). */
export async function registerScheduledWorker(
  boss: PgBoss,
  queue: string,
  cron: string,
  handler: (job: Job<unknown>) => Promise<unknown> | unknown,
  options: TypedWorkerOptions = {},
) {
  const { queueOptions, workOptions } = splitWorkerOptions(options)
  await boss.createQueue(QUEUES.deadLetter)
  await boss.createQueue(queue, queueOptions)
  await boss.work(
    queue,
    { pollingIntervalSeconds: DEFAULT_POLLING_SECONDS, ...workOptions },
    async ([job]) => toOutput(await handler(job)),
  )
  await boss.schedule(queue, cron, null, { tz: 'UTC' })
}

/** Publica os eventos pendentes do outbox nas filas de domínio. */
export async function dispatchPendingEvents(
  boss: PgBoss,
  limit = 100,
  log: Logger = defaultLogger,
) {
  const events = await pendingEvents(limit)
  let published = 0

  for (const event of events) {
    const parsed = domainEventSchemas[event.type as keyof typeof domainEventSchemas]?.safeParse(
      event.payload,
    )
    if (!parsed?.success) {
      // Payload inválido é descartado com log: retry não consertaria um contrato quebrado.
      log.warn({ eventId: event.id, type: event.type }, 'payload de evento inválido')
      await markEventProcessed(event.id)
      continue
    }

    await enqueueJob(boss, event.type, parsed.data, { singletonKey: event.id })
    await markEventProcessed(event.id)
    published += 1
  }

  return published
}

async function setupJobs(boss: PgBoss, options: JobRunnerOptions): Promise<void> {
  const log = options.logger ?? defaultLogger
  const pollingIntervalSeconds = options.pollingIntervalSeconds ?? DEFAULT_POLLING_SECONDS

  boss.on('error', (error: Error) => log.error({ err: error }, 'pg-boss falhou'))

  await boss.start()

  await registerTypedWorker(
    boss,
    QUEUES.newRequest,
    newRequestEventSchema,
    (payload, job) => {
      const handler = handlers.get(QUEUES.newRequest)
      return handler?.(payload, job) ?? runOnce(job.id, QUEUES.newRequest, async () => undefined)
    },
    { pollingIntervalSeconds },
  )

  for (const schedule of SCHEDULES) {
    await registerScheduledWorker(
      boss,
      schedule.queue,
      schedule.cron,
      (job) => handlers.get(schedule.queue)?.(undefined, job),
      { pollingIntervalSeconds },
    )
  }

  await boss.createQueue(QUEUES.deadLetter)
  await boss.createQueue(QUEUES.dispatch, {
    ...RETRY_QUEUE,
    deadLetter: QUEUES.deadLetter,
  })
  await boss.work(QUEUES.dispatch, { pollingIntervalSeconds }, async () => {
    await dispatchPendingEvents(boss, 100, log)
    return { ok: true }
  })
  await boss.schedule(QUEUES.dispatch, DISPATCH_CRON, null, { tz: 'UTC' })
  // Um disparo no boot evita esperar o próximo minuto para publicar eventos.
  await enqueueJob(boss, QUEUES.dispatch, { reason: 'startup' }, { singletonKey: 'outbox-startup' })
}

export interface JobRunnerOptions {
  connectionString: string
  schema?: string
  enabled?: boolean
  logger?: Logger
  clock?: Clock
  spies?: boolean
  max?: number
  pollingIntervalSeconds?: number
  shutdownTimeoutMs?: number
}

export interface JobRunner {
  boss: PgBoss
  start(): Promise<PgBoss>
  stop(): Promise<void>
}

export function createJobRunner(options: JobRunnerOptions): JobRunner {
  const boss = new PgBoss({
    connectionString: options.connectionString,
    schema: options.schema ?? 'pgboss',
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.spies ? { __test__enableSpies: true } : {}),
    ...(options.max ? { max: options.max } : {}),
  })
  let started = false

  return {
    boss,
    async start() {
      if (options.enabled === false) return boss
      await setupJobs(boss, options)
      started = true
      return boss
    },
    async stop() {
      if (!started) return
      started = false
      await boss.stop({ graceful: true, timeout: options.shutdownTimeoutMs ?? 30_000 })
    },
  }
}

let singleton: JobRunner | null = null

export async function startJobs(options: JobRunnerOptions): Promise<PgBoss> {
  if (!singleton) {
    singleton = createJobRunner(options)
    await singleton.start()
  }
  return singleton.boss
}

/** SIGTERM: `boss.stop` é graceful por padrão — handlers em andamento terminam primeiro. */
export async function stopJobs(): Promise<void> {
  await singleton?.stop()
  singleton = null
}

/** Reprocessa a fila de falhas devolvendo os jobs às filas de origem. */
export async function redriveDeadLetter(
  connectionString = process.env.DATABASE_URL ?? '',
  schema = process.env.PG_BOSS_SCHEMA ?? 'pgboss',
): Promise<number> {
  const boss = new PgBoss({ connectionString, schema })
  await boss.start()
  try {
    return await boss.redrive(QUEUES.deadLetter)
  } finally {
    await boss.stop()
  }
}
