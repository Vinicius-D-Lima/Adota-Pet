import {
  notificationPageSchema,
  notificationPreferencesResponseSchema,
  notificationTypes,
} from '@adotapet/shared'
import type { Express } from 'express'
import { SMTPServer } from 'smtp-server'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { ensureTestOrganization } from '../test/organization.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import {
  APPOINTMENT_PROPOSED,
  MESSAGE_RECEIVED,
  REQUEST_STATUS_CHANGED,
  type DomainEventPayload,
} from './events.js'
import {
  notificationHandlerFor,
  sendNotificationEmail,
  setEmailTransport,
  type EnqueueEmail,
  type NotificationEmailJob,
} from './notificationService.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const ORGANIZATION = 'Instituição Notificações'

async function makeUser(id: string, extra: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      id,
      name: `Usuário ${id}`,
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
      ...extra,
    },
  })
  const { token } = await signAccessToken(user)
  return { headers: bearer(token) }
}

async function makeGuardian(id: string) {
  const auth = await makeUser(id, {
    role: 'GUARDIAN',
    roles: ['GUARDIAN'],
    organizationName: ORGANIZATION,
    platformRole: 'MODERADOR',
  })
  await prisma.guardianProfile.create({
    data: {
      userId: id,
      guardianType: 'ORGANIZATION',
      displayName: ORGANIZATION,
      legalName: ORGANIZATION,
      document: '12.345.678/0001-90',
      email: `${id}@exemplo.com`,
      phone: '(11) 3333-4444',
      zipCode: '01310-100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      acceptsTerms: true,
    },
  })
  const organization = await ensureTestOrganization(ORGANIZATION, 'IN')
  await prisma.membership.create({
    data: { userId: id, organizationId: organization.id, role: 'ADMIN', status: 'ATIVO' },
  })
  return auth
}

async function makePet(id: string) {
  const organization = await ensureTestOrganization(ORGANIZATION, 'IN')
  return prisma.pet.create({
    data: {
      id,
      name: 'Luna',
      species: 'Cachorro',
      breed: 'SRD',
      age: 2,
      ageLabel: '2 anos',
      size: 'Médio',
      sex: 'Fêmea',
      city: 'São Paulo',
      image: 'https://example.com/pet.jpg',
      summary: 'Um pet muito querido',
      description: 'Um pet muito querido que procura um novo lar.',
      traits: ['Calmo'],
      energy: 'Moderada',
      space: 'Apartamento',
      children: true,
      otherPets: true,
      organizationId: organization.id,
      createdAt: new Date(),
      status: 'DISPONIVEL',
    },
  })
}

async function makeRequest(id: string, petId: string, userId: string, status = 'Enviada') {
  return prisma.adoptionRequest.create({
    data: {
      id,
      petId,
      userId,
      status,
      date: new Date(),
      message: 'Solicitação em análise.',
    },
  })
}

const statusEvent = (requestId: string, adopterId: string): DomainEventPayload => ({
  requestId,
  adopterId,
  petName: 'Luna',
  status: 'Em análise',
  message: 'A instituição iniciou a análise da sua solicitação.',
})

const fakeEnqueue = () => {
  const jobs: Array<{ job: NotificationEmailJob; singletonKey: string }> = []
  const enqueue: EnqueueEmail = async (job, options) => {
    jobs.push({ job, singletonKey: options.singletonKey })
  }
  return { jobs, enqueue }
}

async function startSmtpServer() {
  const messages: string[] = []
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    onData(stream, _session, callback) {
      let raw = ''
      stream.on('data', (chunk: Buffer) => {
        raw += chunk.toString()
      })
      stream.on('end', () => {
        messages.push(raw)
        callback(null, 'OK')
      })
    },
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.server.address()
  if (!address || typeof address === 'string') throw new Error('SMTP sem porta')
  return { server, messages, port: address.port }
}

databaseSuite('notificações (#30)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    setEmailTransport(null)
    await resetTestDatabase()
  })

  it('[NOT-01] mudança de status notifica o adotante', async () => {
    const guardian = await makeGuardian('org-not-01')
    await makeUser('adopter-not-01')
    await makePet('pet-not-01')
    await makeRequest('SOL-NOT-01', 'pet-not-01', 'adopter-not-01')

    const response = await request(app)
      .post('/api/me/received-requests/SOL-NOT-01/transitions')
      .set(guardian.headers)
      .send({ to: 'EM_ANALISE' })
    expect(response.status).toBe(200)

    const event = await prisma.eventOutbox.findFirstOrThrow({
      where: { type: REQUEST_STATUS_CHANGED },
    })
    await notificationHandlerFor(REQUEST_STATUS_CHANGED)(event.payload as DomainEventPayload)

    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId: 'adopter-not-01' },
    })
    expect(notification).toMatchObject({
      type: REQUEST_STATUS_CHANGED,
      title: 'Solicitação Em análise',
      link: '/solicitacoes/SOL-NOT-01/enviada',
    })
  })

  it('[NOT-02] preferência desligada é respeitada nos dois canais', async () => {
    await makeUser('adopter-not-02')
    const { enqueue, jobs } = fakeEnqueue()

    const preferences = await request(app)
      .get('/api/me/notification-preferences')
      .set(
        bearer(
          (
            await signAccessToken(
              await prisma.user.findUniqueOrThrow({
                where: { id: 'adopter-not-02' },
              }),
            )
          ).token,
        ),
      )
    // A lista acompanha o catálogo compartilhado (inclui remarcação da #21).
    expect(notificationPreferencesResponseSchema.parse(preferences.body).data).toHaveLength(
      notificationTypes.length,
    )

    const disabled = preferences.body.data.map(
      (item: { type: string; inApp: boolean; email: boolean }) =>
        item.type === REQUEST_STATUS_CHANGED ? { ...item, inApp: false, email: false } : item,
    )
    expect(
      (await request(app).put('/api/me/notification-preferences').send({ data: disabled })).status,
    ).toBe(401)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'adopter-not-02' } })
    const { token } = await signAccessToken(user)
    const saved = await request(app)
      .put('/api/me/notification-preferences')
      .set(bearer(token))
      .send({ data: disabled })
    expect(saved.status).toBe(200)

    await notificationHandlerFor(
      REQUEST_STATUS_CHANGED,
      enqueue,
    )(statusEvent('SOL-NOT-02', 'adopter-not-02'))
    expect(await prisma.notification.count({ where: { userId: 'adopter-not-02' } })).toBe(0)
    expect(jobs).toHaveLength(0)
  })

  it('[NOT-03] só lê e marca como lidas as próprias notificações', async () => {
    await makeUser('user-not-03a')
    const other = await makeUser('user-not-03b')
    await prisma.notification.createMany({
      data: [
        {
          id: 'NOT-A',
          userId: 'user-not-03a',
          type: 'MessageReceived',
          title: 'A',
          body: 'A',
          link: '/notificacoes',
          createdAt: new Date(),
        },
        {
          id: 'NOT-B',
          userId: 'user-not-03b',
          type: 'MessageReceived',
          title: 'B',
          body: 'B',
          link: '/notificacoes',
          createdAt: new Date(),
        },
      ],
    })

    const list = await request(app).get('/api/me/notifications').set(other.headers)
    expect(notificationPageSchema.parse(list.body).data.map((item) => item.id)).toEqual(['NOT-B'])

    const denied = await request(app).patch('/api/me/notifications/NOT-A/read').set(other.headers)
    expect(denied.status).toBe(404)
    const unchanged = await prisma.notification.findUniqueOrThrow({ where: { id: 'NOT-A' } })
    expect(unchanged.readAt).toBeNull()
  })

  it('[NOT-04] unreadCount acompanha leitura e novas notificações', async () => {
    await makeUser('user-not-04')
    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'user-not-04' } })
    const { token } = await signAccessToken(user)
    await prisma.notification.createMany({
      data: Array.from({ length: 6 }, (_, index) => ({
        id: `NOT-04-${index}`,
        userId: 'user-not-04',
        type: 'MessageReceived',
        title: `Mensagem ${index}`,
        body: 'Texto',
        link: '/notificacoes',
        createdAt: new Date(Date.now() + index),
      })),
    })

    const before = await request(app).get('/api/me/notifications').set(bearer(token))
    expect(before.body.unreadCount).toBe(6)
    expect(notificationPageSchema.parse(before.body).data).toHaveLength(5)

    expect(
      (await request(app).patch('/api/me/notifications/NOT-04-5/read').set(bearer(token))).status,
    ).toBe(204)
    expect(
      (await request(app).get('/api/me/notifications').set(bearer(token))).body.unreadCount,
    ).toBe(5)

    expect(
      (await request(app).patch('/api/me/notifications/read-all').set(bearer(token))).status,
    ).toBe(204)
    expect(
      (await request(app).get('/api/me/notifications').set(bearer(token))).body.unreadCount,
    ).toBe(0)

    await notificationHandlerFor(APPOINTMENT_PROPOSED)({
      requestId: 'SOL-NOT-04',
      adopterId: 'user-not-04',
      petName: 'Luna',
      type: 'Entrevista online',
      slotCount: 2,
    })
    expect(
      (await request(app).get('/api/me/notifications').set(bearer(token))).body.unreadCount,
    ).toBe(1)
  })

  it('[NOT-05] e-mail é entregue ao servidor SMTP (Mailpit em dev)', async () => {
    await makeUser('user-not-05')
    const smtp = await startSmtpServer()
    try {
      const { createEmailTransport } = await import('./notificationService.js')
      const { loadConfig } = await import('./config.js')
      setEmailTransport(
        createEmailTransport(
          loadConfig({
            ...process.env,
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: String(smtp.port),
            SMTP_SECURE: 'false',
          }),
        ),
      )
      const result = await sendNotificationEmail({
        notificationId: 'NOT-05',
        userId: 'user-not-05',
        subject: 'Solicitação Em análise',
        text: 'A instituição atualizou sua solicitação.',
      })
      expect(result).toEqual({ sent: true })
      const raw = smtp.messages.join('')
      expect(raw).toContain('user-not-05@exemplo.com')
      // Assunto com acentos chega codificado em UTF-8/Q pelo SMTP.
      expect(raw).toContain('Subject:')
      expect(raw).toContain('text/plain')
    } finally {
      await new Promise<void>((resolve) => smtp.server.close(() => resolve()))
    }
  })

  it('[NOT-06] falha no e-mail não bloqueia a notificação in-app', async () => {
    await makeUser('user-not-06')
    const failingEnqueue: EnqueueEmail = async () => {
      throw new Error('fila indisponível')
    }
    const delivery = await notificationHandlerFor(
      REQUEST_STATUS_CHANGED,
      failingEnqueue,
    )(statusEvent('SOL-NOT-06', 'user-not-06'))
    expect(delivery).toMatchObject({ created: true, emailQueued: false })
    expect(await prisma.notification.count({ where: { userId: 'user-not-06' } })).toBe(1)

    setEmailTransport({
      async sendMail() {
        throw new Error('SMTP fora do ar')
      },
    })
    await expect(
      sendNotificationEmail({
        notificationId: 'NOT-06',
        userId: 'user-not-06',
        subject: 'Teste',
        text: 'Teste',
      }),
    ).rejects.toThrow('SMTP fora do ar')
    expect(await prisma.notification.count({ where: { userId: 'user-not-06' } })).toBe(1)
  })

  it('[NOT-07] conteúdo é texto puro e o link só pode ser interno', async () => {
    await makeUser('user-not-07')
    const hostile = {
      requestId: 'SOL-NOT-07',
      messageId: 'MSG-NOT-07',
      recipientId: 'user-not-07',
      senderName: '<script>alert(1)</script>',
      link: 'https://example.com/roubo',
    } as unknown as DomainEventPayload
    await notificationHandlerFor(MESSAGE_RECEIVED)(hostile)

    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId: 'user-not-07' },
    })
    expect(notification.title).not.toContain('<script>')
    expect(notification.link).toBe('/solicitacoes/SOL-NOT-07/enviada')
    expect(
      notificationPageSchema.safeParse({
        data: [
          {
            ...notification,
            readAt: notification.readAt,
            createdAt: notification.createdAt.toISOString(),
          },
        ],
        unreadCount: 1,
      }).success,
    ).toBe(true)
  })

  it('[NOT-08] reprocessar o mesmo evento não duplica a notificação', async () => {
    await makeUser('user-not-08')
    const { enqueue, jobs } = fakeEnqueue()
    const handler = notificationHandlerFor(REQUEST_STATUS_CHANGED, enqueue)
    const payload = statusEvent('SOL-NOT-08', 'user-not-08')

    await handler(payload)
    await handler(payload)

    expect(await prisma.notification.count({ where: { userId: 'user-not-08' } })).toBe(1)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.singletonKey).toBe(jobs[0]?.job.notificationId)
  })

  it('[NOT-09] rotas sem token retornam 401', async () => {
    const endpoints: Array<[string, 'get' | 'put' | 'patch']> = [
      ['/api/me/notifications', 'get'],
      ['/api/me/notifications/NOT-1/read', 'patch'],
      ['/api/me/notifications/read-all', 'patch'],
      ['/api/me/notification-preferences', 'get'],
      ['/api/me/notification-preferences', 'put'],
    ]
    for (const [path, method] of endpoints) {
      const response = await request(app)[method](path).send({})
      expect(response.status, path).toBe(401)
    }
  })
})
