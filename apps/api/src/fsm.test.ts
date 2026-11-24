import { requestStatusCodes, type RequestStatusCode } from '@adotapet/shared'
import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { ensureTestOrganization } from '../test/organization.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { REQUEST_STATUS_CHANGED } from './events.js'
import type { Prisma } from './generated/prisma/client.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const ORGANIZATION = 'Instituição FSM'
const OTHER_ORGANIZATION = 'Outra Instituição FSM'

const ANSWERS = {
  motivation: 'Quero dar um lar cheio de carinho para um pet que precisa de uma segunda chance.',
  routine: 'Trabalho em casa pela manhã e caminho com o pet todas as tardes no parque do bairro.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço calmo e apresentar a rotina da casa aos poucos.',
  costs: true,
  commitment: true,
}

async function makeAdopter(id: string) {
  const user = await prisma.user.create({
    data: {
      id,
      name: 'Ana Souza',
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
    },
  })
  await prisma.adopterProfile.create({
    data: {
      userId: id,
      name: 'Ana Souza',
      cpf: '529.982.247-25',
      birthDate: '1990-05-10',
      email: `${id}@exemplo.com`,
      phone: '(11) 98888-7777',
    },
  })
  const { token } = await signAccessToken(user)
  return { id, headers: bearer(token) }
}

async function makeGuardian(
  id: string,
  organization = ORGANIZATION,
  organizationRole: 'ADMIN' | 'VOLUNTEER' = 'ADMIN',
) {
  const user = await prisma.user.create({
    data: {
      id,
      name: 'Equipe FSM',
      email: `${id}@exemplo.com`,
      platformRole: organizationRole === 'ADMIN' ? 'MODERADOR' : 'USUARIO',
      organizationRole,
      role: 'GUARDIAN',
      roles: ['GUARDIAN'],
      organizationName: organization,
    },
  })
  await prisma.guardianProfile.create({
    data: {
      userId: id,
      guardianType: 'ORGANIZATION',
      displayName: organization,
      legalName: organization,
      document: '12.345.678/0001-90',
      email: `${id}@exemplo.com`,
      phone: '(11) 3333-4444',
      acceptsTerms: true,
    },
  })
  const organizationRow = await ensureTestOrganization(organization, 'IF')
  await prisma.membership.create({
    data: {
      userId: id,
      organizationId: organizationRow.id,
      role: organizationRole,
      status: 'ATIVO',
    },
  })
  const { token } = await signAccessToken(user)
  return { id, headers: bearer(token) }
}

async function makePet(id: string, organization = ORGANIZATION) {
  const organizationRow = await ensureTestOrganization(organization, 'IF')
  return prisma.pet.create({
    data: {
      id,
      name: `Pet ${id}`,
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
      organizationId: organizationRow.id,
      createdAt: new Date(),
      status: 'DISPONIVEL',
    },
  })
}

async function makeRequest(
  id: string,
  status: RequestStatusCode,
  options: { userId?: string; petId?: string; interview?: Prisma.InputJsonValue } = {},
) {
  const petId = options.petId ?? `pet-${id}`
  if (!options.petId) await makePet(petId)
  return prisma.adoptionRequest.create({
    data: {
      id,
      petId,
      userId: options.userId ?? 'fsm-adopter',
      status,
      version: 1,
      date: new Date(),
      message: 'Solicitação em análise.',
      answers: ANSWERS,
      interview: options.interview,
    },
  })
}

const realized = (type: 'Entrevista online' | 'Visita presencial') => ({
  type,
  proposedSlots: [new Date(Date.now() + 86_400_000).toISOString()],
  status: 'REALIZADA',
  completed: true,
  scheduledAt: new Date(Date.now() - 86_400_000).toISOString(),
  completedAt: new Date().toISOString(),
})

const transition = (
  app: Express,
  headers: Record<string, string>,
  id: string,
  to: string,
  reason?: string,
) => request(app).post(`/api/requests/${id}/transitions`).set(headers).send({ to, reason })

databaseSuite('máquina de estados da solicitação (#20)', () => {
  let app: Express
  let adopter: Awaited<ReturnType<typeof makeAdopter>>
  let guardian: Awaited<ReturnType<typeof makeGuardian>>

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
    adopter = await makeAdopter('fsm-adopter')
    guardian = await makeGuardian('fsm-guardian')
    await makePet('fsm-pet')
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[FSM-01] todas as transições válidas da tabela', async () => {
    const cases: Array<{
      from: RequestStatusCode
      to: RequestStatusCode
      actor: 'org' | 'adopter'
      interview?: Prisma.InputJsonValue
    }> = [
      { from: 'ENVIADA', to: 'ANALISE_QUESTIONARIO', actor: 'org' },
      { from: 'ENVIADA', to: 'RECUSADA', actor: 'org' },
      { from: 'ENVIADA', to: 'CANCELADA', actor: 'adopter' },
      { from: 'ANALISE_QUESTIONARIO', to: 'ENTREVISTA', actor: 'org' },
      { from: 'ANALISE_QUESTIONARIO', to: 'RECUSADA', actor: 'org' },
      { from: 'ANALISE_QUESTIONARIO', to: 'CANCELADA', actor: 'adopter' },
      {
        from: 'ENTREVISTA',
        to: 'VISITA_DOMICILIAR',
        actor: 'org',
        interview: realized('Entrevista online'),
      },
      { from: 'ENTREVISTA', to: 'RECUSADA', actor: 'org' },
      { from: 'ENTREVISTA', to: 'CANCELADA', actor: 'adopter' },
      {
        from: 'VISITA_DOMICILIAR',
        to: 'DECISAO_FINAL',
        actor: 'org',
        interview: realized('Visita presencial'),
      },
      { from: 'VISITA_DOMICILIAR', to: 'RECUSADA', actor: 'org' },
      { from: 'VISITA_DOMICILIAR', to: 'CANCELADA', actor: 'adopter' },
      { from: 'DECISAO_FINAL', to: 'APROVADA', actor: 'org' },
      { from: 'DECISAO_FINAL', to: 'RECUSADA', actor: 'org' },
      { from: 'DECISAO_FINAL', to: 'CANCELADA', actor: 'adopter' },
      // Compatibilidade com o atalho antigo (entrevista realizada → aprovar).
      {
        from: 'ANALISE_QUESTIONARIO',
        to: 'APROVADA',
        actor: 'org',
        interview: realized('Entrevista online'),
      },
    ]

    expect(cases.length).toBeGreaterThanOrEqual(requestStatusCodes.length)

    for (const [index, item] of cases.entries()) {
      const id = `SOL-FSM01-${index + 1}`
      await makeRequest(id, item.from, { interview: item.interview })
      const headers = item.actor === 'org' ? guardian.headers : adopter.headers
      const response = await transition(
        app,
        headers,
        id,
        item.to,
        item.to === 'RECUSADA' ? 'Motivo da recusa' : undefined,
      )
      expect(response.status, `${item.from} → ${item.to}`).toBe(200)
      const stored = await prisma.adoptionRequest.findUniqueOrThrow({ where: { id } })
      expect(stored.status).toBe(item.to)
      expect(stored.version).toBe(2)
    }
  })

  it('[FSM-02] transições fora da tabela retornam 409 com a mensagem exata', async () => {
    const invalidCases: Array<[RequestStatusCode, RequestStatusCode]> = [
      ['ENVIADA', 'ENTREVISTA'],
      ['ENVIADA', 'VISITA_DOMICILIAR'],
      ['ENVIADA', 'DECISAO_FINAL'],
      ['ENVIADA', 'APROVADA'],
      ['ANALISE_QUESTIONARIO', 'VISITA_DOMICILIAR'],
      ['ANALISE_QUESTIONARIO', 'DECISAO_FINAL'],
      ['ENTREVISTA', 'APROVADA'],
      ['VISITA_DOMICILIAR', 'APROVADA'],
      ['DECISAO_FINAL', 'ENTREVISTA'],
    ]
    for (const [index, [from, to]] of invalidCases.entries()) {
      const id = `SOL-FSM02-${index + 1}`
      await makeRequest(id, from)
      const response = await transition(app, guardian.headers, id, to)
      expect(response.status, `${from} → ${to}`).toBe(409)
      expect(response.body.message).toBe(`transição inválida de ${from} para ${to}`)
      const stored = await prisma.adoptionRequest.findUniqueOrThrow({ where: { id } })
      expect(stored.status).toBe(from)
    }
  })

  it('[FSM-03] só o responsável avança etapas ou recusa', async () => {
    await makeRequest('SOL-FSM03', 'ENVIADA')
    const outsider = await makeAdopter('fsm-outsider')
    const otherOrg = await makeGuardian('fsm-other-org', OTHER_ORGANIZATION)

    for (const headers of [adopter.headers, outsider.headers, otherOrg.headers]) {
      const denied = await transition(app, headers, 'SOL-FSM03', 'ANALISE_QUESTIONARIO')
      expect(denied.status).toBe(403)
    }
    const volunteer = await makeGuardian('fsm-volunteer', ORGANIZATION, 'VOLUNTEER')
    const allowed = await transition(app, volunteer.headers, 'SOL-FSM03', 'ANALISE_QUESTIONARIO')
    expect(allowed.status).toBe(200)
  })

  it('[FSM-04] só o adotante da solicitação cancela (BOLA/IDOR)', async () => {
    await makeRequest('SOL-FSM04', 'ENVIADA')
    const otherAdopter = await makeAdopter('fsm-other-adopter')

    for (const headers of [otherAdopter.headers, guardian.headers]) {
      const denied = await transition(app, headers, 'SOL-FSM04', 'CANCELADA')
      expect(denied.status).toBe(403)
    }
    const allowed = await transition(app, adopter.headers, 'SOL-FSM04', 'CANCELADA')
    expect(allowed.status).toBe(200)
    const stored = await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: 'SOL-FSM04' } })
    expect(stored.status).toBe('CANCELADA')
  })

  it('[FSM-05] recusar exige motivo', async () => {
    await makeRequest('SOL-FSM05', 'ENVIADA')
    const missing = await transition(app, guardian.headers, 'SOL-FSM05', 'RECUSADA')
    expect(missing.status).toBe(400)
    expect(missing.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'reason' })]),
    )

    const blank = await transition(app, guardian.headers, 'SOL-FSM05', 'RECUSADA', '   ')
    expect(blank.status).toBe(400)

    const valid = await transition(
      app,
      guardian.headers,
      'SOL-FSM05',
      'RECUSADA',
      'Perfil incompatível com as necessidades do pet.',
    )
    expect(valid.status).toBe(200)
    const stored = await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: 'SOL-FSM05' } })
    expect(stored.rejectionReason).toBe('Perfil incompatível com as necessidades do pet.')
  })

  it('[FSM-06] cada transição grava de, para, quem, quando e motivo', async () => {
    await makeRequest('SOL-FSM06', 'ENVIADA')
    await transition(app, guardian.headers, 'SOL-FSM06', 'ANALISE_QUESTIONARIO')
    await transition(app, guardian.headers, 'SOL-FSM06', 'ENTREVISTA')
    await transition(app, guardian.headers, 'SOL-FSM06', 'RECUSADA', 'Motivo auditado')

    const response = await request(app)
      .get('/api/requests/SOL-FSM06/status-history')
      .set(adopter.headers)
    expect(response.status).toBe(200)
    expect(response.body.total).toBe(3)
    expect(response.body.data).toMatchObject([
      {
        from: 'ENVIADA',
        to: 'ANALISE_QUESTIONARIO',
        actorId: guardian.id,
        actorRole: 'ADMIN',
        reason: null,
      },
      {
        from: 'ANALISE_QUESTIONARIO',
        to: 'ENTREVISTA',
        actorId: guardian.id,
        actorRole: 'ADMIN',
        reason: null,
      },
      {
        from: 'ENTREVISTA',
        to: 'RECUSADA',
        actorId: guardian.id,
        actorRole: 'ADMIN',
        reason: 'Motivo auditado',
      },
    ])
    for (const entry of response.body.data) {
      expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false)
      expect(entry.id).toBeTruthy()
    }
  })

  it('[FSM-07] estados finais não aceitam transição', async () => {
    for (const [index, state] of ['APROVADA', 'RECUSADA', 'CANCELADA'].entries()) {
      const id = `SOL-FSM07-${index + 1}`
      await makeRequest(id, state as RequestStatusCode)
      const byOrg = await transition(app, guardian.headers, id, 'ANALISE_QUESTIONARIO')
      const byAdopter = await transition(app, adopter.headers, id, 'CANCELADA')
      for (const response of [byOrg, byAdopter]) {
        expect(response.status).toBe(409)
        expect(response.body.message).toMatch(/^transição inválida de /)
      }
    }
  })

  it('[FSM-08] ENTREVISTA e VISITA_DOMICILIAR exigem agendamento realizado', async () => {
    await makeRequest('SOL-FSM08-A', 'ENTREVISTA')
    await makeRequest('SOL-FSM08-B', 'ENTREVISTA', {
      interview: realized('Visita presencial'),
    })
    await makeRequest('SOL-FSM08-C', 'ENTREVISTA', {
      interview: realized('Entrevista online'),
    })
    await makeRequest('SOL-FSM08-D', 'VISITA_DOMICILIAR')
    await makeRequest('SOL-FSM08-E', 'VISITA_DOMICILIAR', {
      interview: realized('Entrevista online'),
    })
    await makeRequest('SOL-FSM08-F', 'VISITA_DOMICILIAR', {
      interview: realized('Visita presencial'),
    })

    const blocked = await Promise.all([
      transition(app, guardian.headers, 'SOL-FSM08-A', 'VISITA_DOMICILIAR'),
      transition(app, guardian.headers, 'SOL-FSM08-B', 'VISITA_DOMICILIAR'),
      transition(app, guardian.headers, 'SOL-FSM08-D', 'DECISAO_FINAL'),
      transition(app, guardian.headers, 'SOL-FSM08-E', 'DECISAO_FINAL'),
    ])
    for (const response of blocked) {
      expect(response.status).toBe(409)
      expect(response.body.message).toMatch(/agendamento/i)
    }

    expect(
      (await transition(app, guardian.headers, 'SOL-FSM08-C', 'VISITA_DOMICILIAR')).status,
    ).toBe(200)
    expect((await transition(app, guardian.headers, 'SOL-FSM08-F', 'DECISAO_FINAL')).status).toBe(
      200,
    )
  })

  it('[FSM-09] transições simultâneas: só uma vence (controle de versão)', async () => {
    await makeRequest('SOL-FSM09', 'ENVIADA')
    const [cancel, advance] = await Promise.all([
      transition(app, adopter.headers, 'SOL-FSM09', 'CANCELADA'),
      transition(app, guardian.headers, 'SOL-FSM09', 'ANALISE_QUESTIONARIO'),
    ])
    expect([cancel.status, advance.status].sort()).toEqual([200, 409])

    const stored = await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: 'SOL-FSM09' } })
    expect(['CANCELADA', 'ANALISE_QUESTIONARIO']).toContain(stored.status)
    expect(stored.version).toBe(2)
    expect(await prisma.requestStatusHistory.count({ where: { requestId: 'SOL-FSM09' } })).toBe(1)
  })

  it('[FSM-10] to e reason são validados; HTML fica como texto puro', async () => {
    await makeRequest('SOL-FSM10-A', 'ENVIADA')
    const badTo = await transition(
      app,
      guardian.headers,
      'SOL-FSM10-A',
      '<script>alert(1)</script>',
    )
    expect(badTo.status).toBe(400)
    const extraKey = await request(app)
      .post('/api/requests/SOL-FSM10-A/transitions')
      .set(guardian.headers)
      .send({ to: 'ANALISE_QUESTIONARIO', admin: true })
    expect(extraKey.status).toBe(400)

    const script = '<script>alert("xss")</script>'
    const rejected = await transition(app, guardian.headers, 'SOL-FSM10-A', 'RECUSADA', script)
    expect(rejected.status).toBe(200)
    const history = await prisma.requestStatusHistory.findFirstOrThrow({
      where: { requestId: 'SOL-FSM10-A', toStatus: 'RECUSADA' },
    })
    expect(history.reason).toBe(script)
    expect(rejected.body.message).toContain(script)
  })

  it('[FSM-11] cada transição enfileira RequestStatusChanged com origem e destino', async () => {
    await makeRequest('SOL-FSM11', 'ENVIADA')
    const response = await transition(app, guardian.headers, 'SOL-FSM11', 'ANALISE_QUESTIONARIO')
    expect(response.status).toBe(200)

    const events = await prisma.eventOutbox.findMany({ where: { type: REQUEST_STATUS_CHANGED } })
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({
      requestId: 'SOL-FSM11',
      adopterId: adopter.id,
      from: 'ENVIADA',
      to: 'ANALISE_QUESTIONARIO',
      actorId: guardian.id,
      actorRole: 'ADMIN',
      status: 'Em análise',
    })
  })
})
