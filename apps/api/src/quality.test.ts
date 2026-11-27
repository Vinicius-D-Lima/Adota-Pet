import { Buffer } from 'node:buffer'
import type { Express } from 'express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ORGANIZATION,
  PROFILE,
  QUESTIONNAIRE,
  type Headers,
  addMembership,
  bearer,
  makePet,
  makeRequest,
  makeUser,
} from '../test/factories.js'
import { hasTestDatabase } from '../test/database.js'
import { ensureTestOrganization } from '../test/organization.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'
import { type StorageProvider, setStorageProvider } from './storage.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const PASSWORD = 'Senha@123'
const DAY = 86_400_000
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString()

/** PNG 1x1 válido e um ELF renomeado: o conteúdo, não a extensão, decide. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)
const EXECUTABLE = Buffer.from('7f454c4602010100000000000000000002003e0001000000', 'hex')

const ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
}

/** Contrato #47: todo erro tem statusCode/error/message; details só quando há campos. */
function expectError(response: { status: number; body: Record<string, unknown> }, status: number) {
  expect(response.status).toBe(status)
  expect(response.body).toMatchObject({
    statusCode: status,
    error: ERROR_NAMES[status],
    message: expect.any(String),
  })
}

/** Validação: `details` é sempre uma lista não vazia de pares { field, message }. */
function expectDetails(
  response: { status: number; body: Record<string, unknown> },
  fields: string[],
) {
  expectError(response, 400)
  const details = response.body.details as Array<{ field: string; message: string }>
  expect(Array.isArray(details)).toBe(true)
  expect(details.length).toBeGreaterThan(0)
  for (const detail of details) {
    expect(Object.keys(detail).sort()).toEqual(['field', 'message'])
    expect(typeof detail.field).toBe('string')
    expect(typeof detail.message).toBe('string')
    expect(detail.message.length).toBeGreaterThan(0)
  }
  for (const field of fields) {
    expect(details.map(({ field: name }) => name)).toContain(field)
  }
  return details
}

/**
 * Divergência observada: `makePet` omite `createdAt`, obrigatório no schema atual.
 * Tentamos a factory primeiro; se ela falhar exatamente por esse campo, replicamos
 * os dados com `createdAt`, sem alterar a factory nem o código de produção.
 */
async function makeQualityPet(id: string, options: Parameters<typeof makePet>[1] = {}) {
  try {
    return await makePet(id, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('createdAt')) throw error
  }

  const organization = await ensureTestOrganization(options.organization ?? ORGANIZATION, 'IP')
  return prisma.pet.create({
    data: {
      id,
      name: options.name ?? `Pet ${id}`,
      species: 'Cachorro',
      breed: 'SRD',
      age: 2,
      ageLabel: '2 anos',
      size: 'Médio',
      sex: 'Fêmea',
      city: 'São Paulo',
      image: 'https://example.com/pet.jpg',
      summary: 'Um pet muito querido',
      description: options.description ?? 'Um pet muito querido que procura um novo lar.',
      traits: ['Calmo'],
      energy: 'Moderada',
      space: 'Apartamento',
      children: true,
      otherPets: true,
      organizationId: organization.id,
      status: options.status ?? 'DISPONIVEL',
      createdAt: new Date(),
    },
  })
}

/** Cenário de adoção sem depender de `makeAdoption`, que usa a `makePet` quebrada. */
async function makeAdoptionFixture(id: string, organizationName = ORGANIZATION) {
  const adopter = await makeUser(`${id}-adopter`)
  const admin = await makeUser(`${id}-admin`, { guardian: true, organizationName })
  await addMembership(admin.user.id, organizationName)
  const pet = await makeQualityPet(`${id}-pet`, { organization: organizationName })
  const request = await makeRequest(`${id}-request`, adopter.user.id, pet.id)
  const adoption = await prisma.adoption.create({
    data: {
      requestId: request.id,
      petId: pet.id,
      adopterId: adopter.user.id,
      organizationId: pet.organizationId,
    },
  })
  await prisma.pet.update({ where: { id: pet.id }, data: { status: 'ADOTADO' } })
  return { adoption, adopter, admin, pet, request }
}

const register = (app: Express, body: object) => request(app).post('/api/auth/register').send(body)
const login = (app: Express, body: object) => request(app).post('/api/auth/login').send(body)

const validPetBody = (name: string) => ({
  name,
  species: 'Cachorro',
  breed: 'SRD',
  age: 2,
  size: 'Médio',
  sex: 'Fêmea',
  city: 'São Paulo',
  image: 'https://example.com/novo-pet.jpg',
  summary: 'Um pet muito querido',
  description: 'Um pet muito querido que procura um novo lar.',
  traits: ['Brincalhão'],
  energy: 'Moderada',
  space: 'Quintal',
  children: true,
  otherPets: false,
})

const validOrganizationBody = (suffix: string) => ({
  name: `Organização ${suffix}`,
  initials: `Q${suffix}`,
  description: 'Organização dedicada à proteção e adoção responsável de animais.',
  city: 'São Paulo, SP',
  contactEmail: `contato-${suffix}@exemplo.com`,
  phone: '11999990000',
})

/**
 * Issues #136/#137/#138: matrizes de validação/negativa e a corrida de candidatos
 * ao mesmo pet. Cada ID é um caso independente; o app é recriado por teste para
 * isolar os limites de requisição em memória, como nos testes existentes.
 */
databaseSuite('qualidade: validação, casos negativos e concorrência (#136/#137/#138)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[VAL-01] matriz de cadastro: nome vazio, e-mail, senha, duplicidade e sucesso', async () => {
    // AUTH-01..04 cobrem normalização/hash isoladamente; aqui o foco é a matriz
    // completa de respostas, incluindo o nome em branco que faltava.
    const invalid = [
      {
        label: 'nome vazio',
        body: { name: '   ', email: 'val01-nome@exemplo.com', password: PASSWORD },
        field: 'name',
      },
      {
        label: 'e-mail inválido',
        body: { name: 'Ana Souza', email: 'sem-arroba', password: PASSWORD },
        field: 'email',
      },
      {
        label: 'senha curta',
        body: { name: 'Ana Souza', email: 'val01-senha@exemplo.com', password: 'curta' },
        field: 'password',
      },
    ] as const
    for (const item of invalid) {
      expectDetails(await register(app, item.body), [item.field])
    }

    const createdResponse = await register(app, {
      name: 'Ana Souza',
      email: 'Val01@Exemplo.COM',
      password: PASSWORD,
    })
    expect(createdResponse.status).toBe(201)
    expect(createdResponse.body.user).toMatchObject({ email: 'val01@exemplo.com' })
    expect(createdResponse.body.accessToken).toEqual(expect.any(String))

    const duplicated = await register(app, {
      name: 'Ana Souza',
      email: 'VAL01@exemplo.com',
      password: PASSWORD,
    })
    expectError(duplicated, 409)

    // Escopo por e-mail: suítes paralelas compartilham o mesmo banco de teste.
    expect(await prisma.user.count({ where: { email: 'val01@exemplo.com' } })).toBe(1)
    const created = await prisma.user.findUniqueOrThrow({
      where: { email: 'val01@exemplo.com' },
    })
    expect(created.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('[VAL-02] matriz de pet e organização: campos, enum, URL e chave desconhecida', async () => {
    // Divergência: a factory não exporta `makeGuardian`; a identidade da
    // instituição é `makeUser({ guardian: true })` + `addMembership`.
    const guardian = await makeUser('val-02-guardian', { guardian: true })
    await addMembership(guardian.user.id)
    const user = await makeUser('val-02-owner')

    const petCases: Array<[Partial<ReturnType<typeof validPetBody>>, string]> = [
      [{ name: '  ' }, 'name'],
      [{ species: 'Dragão' }, 'species'],
      [{ age: -1 }, 'age'],
      [{ image: 'nao-e-url' }, 'image'],
      [{ traits: [] }, 'traits'],
    ]
    for (const [override, field] of petCases) {
      const response = await request(app)
        .post('/api/pets')
        .set(guardian.headers)
        .send({ ...validPetBody('Pet VAL-02'), ...override })
      expectDetails(response, [field])
    }
    expect(await prisma.pet.count()).toBe(0)

    const organizationCases: Array<[object, string]> = [
      [{ ...validOrganizationBody('a'), name: ' ' }, 'name'],
      [{ ...validOrganizationBody('b'), contactEmail: 'invalido' }, 'contactEmail'],
      [{ ...validOrganizationBody('c'), nivel: 'ouro' }, 'nivel'],
    ]
    for (const [body, field] of organizationCases) {
      const response = await request(app).post('/api/organizations').set(user.headers).send(body)
      expectDetails(response, [field])
    }
    // `addMembership` já garante a organização da factory; o caso não cria outras.
    expect(await prisma.organization.count()).toBe(1)

    // O formulário da área da instituição usa sua própria validação (strings).
    const formResponse = await request(app)
      .post('/api/me/organization-pets')
      .set(guardian.headers)
      .send({
        ...validPetBody('Pet Formulário'),
        age: 31,
        traits: 'Calmo',
        children: 'true',
        otherPets: 'false',
        image: 'nao-e-url',
      })
    expectDetails(formResponse, ['age', 'image'])
    expect(await prisma.pet.count()).toBe(0)
  })

  it('[VAL-03] matriz de solicitação e perfil: vários erros no mesmo details', async () => {
    const adopter = await makeUser('val-03-adopter')
    await makeQualityPet('val-03-pet')

    const requestResponse = await request(app)
      .post('/api/requests')
      .set(adopter.headers)
      .send({
        petId: 'val-03-pet',
        answers: {
          ...QUESTIONNAIRE,
          motivation: 'curto',
          aloneTime: 'Qualquer tempo',
          costs: false,
        },
      })
    expectDetails(requestResponse, ['answers.motivation', 'answers.aloneTime', 'answers.costs'])
    expect(await prisma.adoptionRequest.count()).toBe(0)

    const before = await prisma.adopterProfile.findUniqueOrThrow({
      where: { userId: adopter.user.id },
    })
    const profileResponse = await request(app)
      .put('/api/me/adopter-profile')
      .set(adopter.headers)
      .send({
        cpf: '00000000000',
        birthDate: '2015-01-01',
        housing: 'Habitacao invalida',
        phone: '123',
      })
    expectDetails(profileResponse, ['cpf', 'birthDate', 'housing', 'phone'])
    expect(
      await prisma.adopterProfile.findUniqueOrThrow({ where: { userId: adopter.user.id } }),
    ).toMatchObject({ cpf: before.cpf, housing: PROFILE.housing, phone: PROFILE.phone })

    const account = await request(app)
      .put('/api/me/account')
      .set(adopter.headers)
      .send({ ...PROFILE, accountType: 'desconhecido', password: PASSWORD })
    expect(account.status).toBe(400)
    expect(Array.isArray(account.body.details)).toBe(true)
    expect(account.body.details.length).toBeGreaterThan(0)
  })

  it('[VAL-04] matriz de agendamento: tipo, horários e formato ISO', async () => {
    const guardian = await makeUser('val-04-guardian', { guardian: true })
    await addMembership(guardian.user.id)
    const adopter = await makeUser('val-04-adopter')
    await makeQualityPet('val-04-pet')
    await makeRequest('SOL-VAL04', adopter.user.id, 'val-04-pet', { status: 'ENTREVISTA' })

    const propose = (body: object) =>
      request(app)
        .post('/api/me/received-requests/SOL-VAL04/appointments')
        .set(guardian.headers)
        .send(body)

    const cases: Array<[object, string]> = [
      [{ proposedSlots: [future(1)] }, 'type'],
      [{ type: 'ENTREVISTA' }, 'proposedSlots'],
      [{ type: 'ENTREVISTA', proposedSlots: [] }, 'proposedSlots'],
      [{ type: 'ENTREVISTA', proposedSlots: ['amanha'] }, 'proposedSlots.0'],
      [
        { type: 'ENTREVISTA', proposedSlots: [new Date(Date.now() - DAY).toISOString()] },
        'proposedSlots.0',
      ],
      [
        { type: 'ENTREVISTA', proposedSlots: [future(1), future(2), future(3), future(4)] },
        'proposedSlots',
      ],
    ]
    for (const [body, field] of cases) expectDetails(await propose(body), [field])

    expect((await propose({ type: 'ENTREVISTA', proposedSlots: [future(2)] })).status).toBe(201)
    expect(await prisma.appointment.count()).toBe(1)
  })

  it('[VAL-05] formato de details é consistente entre rotas; erros operacionais não o inventam', async () => {
    const user = await makeUser('val-05-user')
    const guardian = await makeUser('val-05-guardian', { guardian: true })
    await addMembership(guardian.user.id)

    const validationErrors = [
      await register(app, { name: 'A', email: 'val05@exemplo.com', password: PASSWORD }),
      await request(app).post('/api/pets').set(guardian.headers).send({ name: 'Sem dados' }),
      await request(app)
        .post('/api/organizations')
        .set(user.headers)
        .send({ name: 'X', contactEmail: 'invalido' }),
      await request(app)
        .post('/api/requests')
        .set(user.headers)
        .send({ petId: 'val-05-pet', answers: {} }),
      await request(app)
        .put('/api/me/adopter-profile')
        .set(user.headers)
        .send({ housing: 'Invalido' }),
      await request(app)
        .post('/api/me/received-requests/SOL-INEZISTENTE/appointments')
        .set(guardian.headers)
        .send({ type: 'ENTREVISTA', proposedSlots: [] }),
    ]
    for (const response of validationErrors) expectDetails(response, [])

    // 404/409/401 são erros operacionais: seguem o envelope, sem `details`.
    const operationalErrors = [
      await request(app).get('/api/pets/val-05-inexistente'),
      await request(app).get('/api/requests/SOL-INEZISTENTE').set(user.headers),
      await request(app).get('/api/me'),
    ]
    for (const response of operationalErrors) {
      expectError(response, response.status)
      expect(response.body.details).toBeUndefined()
    }
  })

  it('[NEG-01] login e /me: identidade inexistente não vira sessão', async () => {
    expect(
      (await register(app, { name: 'Ana Souza', email: 'neg01@exemplo.com', password: PASSWORD }))
        .status,
    ).toBe(201)

    const unknownEmail = await login(app, {
      email: 'ninguem@exemplo.com',
      password: PASSWORD,
    })
    const wrongPassword = await login(app, {
      email: 'neg01@exemplo.com',
      password: 'senha-errada',
    })
    for (const response of [unknownEmail, wrongPassword]) {
      expectError(response, 401)
      expect(response.body.message).toBe('Credenciais inválidas')
      expect(response.body.accessToken).toBeUndefined()
    }
    // AUTH-05 compara os dois caminhos; aqui a garantia é não vazar tokens.
    expect(unknownEmail.body).toEqual(wrongPassword.body)

    expectDetails(await login(app, { email: 'sem-arroba', password: PASSWORD }), ['email'])
    const empty = await login(app, { email: '', password: '' })
    expectDetails(empty, ['email', 'password'])

    // Token assinado corretamente, mas sem usuário no banco: 401 (não 404).
    const orphanToken = await signAccessToken({ id: 'neg01-fantasma', platformRole: 'USUARIO' })
    for (const path of ['/api/auth/me', '/me', '/api/me/adopter-profile']) {
      const response = await request(app).get(path).set(bearer(orphanToken.token))
      expectError(response, 401)
    }
  })

  it('[NEG-02] favoritos e convites: operações sem alvo ou repetidas', async () => {
    const admin = await makeUser('neg-02-admin')
    const outsider = await makeUser('neg-02-outsider')

    const missingFavorite = await request(app)
      .put('/api/me/favorites/pet-inexistente')
      .set(admin.headers)
    expectError(missingFavorite, 404)
    expect(await prisma.favorite.count()).toBe(0)
    expect((await request(app).get('/api/me/favorites/ids').set(admin.headers)).body.data).toEqual(
      [],
    )

    const created = await request(app)
      .post('/api/organizations')
      .set(admin.headers)
      .send(validOrganizationBody('neg02'))
    expect(created.status).toBe(201)
    const organizationId = created.body.id as string
    const invite = (body: object, headers: Headers = admin.headers) =>
      request(app).post(`/api/organizations/${organizationId}/invitations`).set(headers).send(body)

    expectDetails(await invite({ email: 'invalido', role: 'VOLUNTEER' }), ['email'])
    expectDetails(await invite({ email: 'convite@exemplo.com', role: 'OWNER' }), ['role'])

    const pending = await invite({ email: 'convite@exemplo.com', role: 'VOLUNTEER' })
    expect(pending.status).toBe(201)
    const repeated = await invite({ email: 'CONVITE@exemplo.com', role: 'VOLUNTEER' })
    expectError(repeated, 409)
    expect(await prisma.invitation.count()).toBe(1)

    const alreadyMember = await invite({ email: admin.user.email, role: 'ADMIN' })
    expectError(alreadyMember, 409)
    expectError(
      await invite({ email: 'outsider@exemplo.com', role: 'ADMIN' }, outsider.headers),
      403,
    )
    expect(await prisma.invitation.count()).toBe(1)
  })

  it('[NEG-03] transições de solicitação: alvo inexistente, to inválido e self-loop', async () => {
    const guardian = await makeUser('neg-03-guardian', { guardian: true })
    await addMembership(guardian.user.id)
    const adopter = await makeUser('neg-03-adopter')
    await makeQualityPet('neg-03-pet')
    await makeRequest('SOL-NEG03', adopter.user.id, 'neg-03-pet', {
      status: 'ANALISE_QUESTIONARIO',
    })

    const transition = (id: string, body: object) =>
      request(app).post(`/api/requests/${id}/transitions`).set(guardian.headers).send(body)

    expectError(await transition('SOL-NAO-EXISTE', { to: 'ENTREVISTA' }), 404)
    expectDetails(await transition('SOL-NEG03', { to: 'ESTADO-INVALIDO' }), ['to'])
    expectDetails(await transition('SOL-NEG03', {}), ['to'])

    const selfLoop = await transition('SOL-NEG03', { to: 'ANALISE_QUESTIONARIO' })
    expectError(selfLoop, 409)
    expect(selfLoop.body.message).toBe(
      'transição inválida de ANALISE_QUESTIONARIO para ANALISE_QUESTIONARIO',
    )

    const stored = await prisma.adoptionRequest.findUniqueOrThrow({ where: { id: 'SOL-NEG03' } })
    expect(stored.status).toBe('ANALISE_QUESTIONARIO')
    expect(stored.version).toBe(1)
    expect(await prisma.requestStatusHistory.count({ where: { requestId: 'SOL-NEG03' } })).toBe(0)
  })

  /** NEG-04/05 precisam de storage: provedor em memória, sem rede. */
  describe('check-ins com armazenamento em memória', () => {
    const files = new Map<string, { body: Buffer; contentType: string }>()
    const provider: StorageProvider = {
      bucket: 'quality-test',
      async ensureBucket() {},
      async putObject({ key, body, contentType }) {
        files.set(key, { body, contentType })
        return { key, contentType, sizeBytes: body.byteLength }
      },
      async getObject(key) {
        const file = files.get(key)
        if (!file) throw new Error('objeto ausente')
        return { ...file, sizeBytes: file.body.byteLength }
      },
      async deleteObject(key) {
        files.delete(key)
      },
      async objectExists(key) {
        return files.has(key)
      },
      async presignGet() {
        return 'http://storage.test/objeto'
      },
    }
    let previousEnv: Record<string, string | undefined>

    beforeAll(() => {
      previousEnv = {
        STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
        STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
        STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
      }
      process.env.STORAGE_ENDPOINT = 'http://storage.test'
      process.env.STORAGE_ACCESS_KEY_ID = 'teste'
      process.env.STORAGE_SECRET_ACCESS_KEY = 'teste'
      setStorageProvider(provider)
    })

    beforeEach(() => {
      files.clear()
    })

    afterAll(() => {
      setStorageProvider(null)
      files.clear()
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    const submit = (id: string, headers: Headers, attachments: Array<[Buffer, string]>) => {
      let call = request(app)
        .post(`/api/check-ins/${id}/submit`)
        .set(headers)
        .field('report', 'Tudo está indo bem na adaptação.')
      for (const [body, filename] of attachments) call = call.attach('files', body, filename)
      return call
    }

    it('[NEG-04] plano fora da janela, plano duplicado e check-in fora de estado', async () => {
      const { adoption, adopter, admin } = await makeAdoptionFixture('neg-04')
      const planUrl = `/api/adoptions/${adoption.id}/follow-up-plan`

      const invalidPlans: Array<[object, string]> = [
        [{ durationDays: 0, intervalDays: 0 }, 'durationDays'],
        [{ durationDays: 10, intervalDays: 20 }, 'intervalDays'],
        [{ durationDays: 1.5, intervalDays: 1 }, 'durationDays'],
        [{ durationDays: 3_651, intervalDays: 1 }, 'durationDays'],
        [{ durationDays: 15, intervalDays: 15, extra: true }, 'extra'],
      ]
      for (const [body, field] of invalidPlans) {
        const response = await request(app).post(planUrl).set(admin.headers).send(body)
        expectError(response, 400)
        expect(response.body.message).toBe('Plano de acompanhamento inválido')
        expectDetails(response, [field])
      }

      const createdPlan = await request(app)
        .post(planUrl)
        .set(admin.headers)
        .send({ durationDays: 15, intervalDays: 15 })
      expect(createdPlan.status).toBe(201)
      expect(createdPlan.body.checkIns).toHaveLength(1)

      const duplicated = await request(app)
        .post(planUrl)
        .set(admin.headers)
        .send({ durationDays: 30, intervalDays: 15 })
      expectError(duplicated, 409)
      expect(await prisma.followUpPlan.count({ where: { adoptionId: adoption.id } })).toBe(1)
      expect(await prisma.checkIn.count({ where: { adoptionId: adoption.id } })).toBe(1)

      const checkIn = await prisma.checkIn.findFirstOrThrow({ where: { adoptionId: adoption.id } })
      const tooEarly = await request(app)
        .post(`/api/check-ins/${checkIn.id}/review`)
        .set(admin.headers)
        .send({ reviewerComment: 'Revisão antes do envio.' })
      expectError(tooEarly, 409)

      expect((await submit(checkIn.id, adopter.headers, [[PNG, 'foto.png']])).status).toBe(200)
      const duplicatedSubmit = await submit(checkIn.id, adopter.headers, [[PNG, 'outra.png']])
      expectError(duplicatedSubmit, 409)
      expect(await prisma.storageObject.count({ where: { resourceId: checkIn.id } })).toBe(1)
    })

    it('[NEG-05] upload inválido não grava objeto nem atualiza o check-in', async () => {
      const { adoption, adopter } = await makeAdoptionFixture('neg-05')
      const pending = await prisma.checkIn.create({
        data: { adoptionId: adoption.id, dueDate: new Date(Date.now() + DAY) },
      })

      const invalid = await submit(pending.id, adopter.headers, [[EXECUTABLE, 'executavel.png']])
      expectError(invalid, 400)
      expect(invalid.body.message).toBe('Upload inválido')
      expectDetails(invalid, ['files[executavel.png]'])
      expect(files.size).toBe(0)
      expect(await prisma.storageObject.count()).toBe(0)
      expect(await prisma.checkIn.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({
        status: 'PENDENTE',
        photos: [],
      })

      const noFile = await submit(pending.id, adopter.headers, [])
      expectError(noFile, 400)
      expect(noFile.body.message).toBe('Envie ao menos um arquivo')
      expect(files.size).toBe(0)
      expect(await prisma.storageObject.count()).toBe(0)
    })
  })

  it('[CONC-01] dois candidatos ao mesmo pet geram duas solicitações e no máximo uma adoção', async () => {
    const admin = await makeUser('conc-01-admin', { guardian: true })
    await addMembership(admin.user.id)
    const pet = await makeQualityPet('conc-01-pet')
    const first = await makeUser('conc-01-primeiro')
    const second = await makeUser('conc-01-segundo')

    for (const headers of [first.headers, second.headers]) {
      const profile = await request(app).get('/api/me/adopter-profile').set(headers)
      expect(profile.status).toBe(200)
      expect(profile.body.isComplete).toBe(true)
    }

    const body = { petId: pet.id, answers: QUESTIONNAIRE }
    const [firstRequest, secondRequest] = await Promise.all([
      request(app).post('/api/requests').set(first.headers).send(body),
      request(app).post('/api/requests').set(second.headers).send(body),
    ])
    // Diferente de REQ-07: aqui são adotantes distintos, então as duas vagam.
    expect([firstRequest.status, secondRequest.status]).toEqual([201, 201])

    const candidates = await prisma.adoptionRequest.findMany({
      where: { petId: pet.id },
      orderBy: { id: 'asc' },
    })
    expect(candidates).toHaveLength(2)
    expect(new Set(candidates.map(({ userId }) => userId))).toEqual(
      new Set([first.user.id, second.user.id]),
    )

    // A FSM exige entrevista realizada com o tipo da etapa; atualizamos o
    // campo entre as transições exatamente como a área da instituição faz.
    for (const candidate of candidates) {
      await prisma.adoptionRequest.update({
        where: { id: candidate.id },
        data: {
          interview: { type: 'Entrevista online', status: 'REALIZADA', completed: true },
        },
      })
      for (const to of ['ANALISE_QUESTIONARIO', 'ENTREVISTA', 'VISITA_DOMICILIAR']) {
        const response = await request(app)
          .post(`/api/requests/${candidate.id}/transitions`)
          .set(admin.headers)
          .send({ to })
        expect(response.status).toBe(200)
      }
      await prisma.adoptionRequest.update({
        where: { id: candidate.id },
        data: {
          interview: { type: 'Visita presencial', status: 'REALIZADA', completed: true },
        },
      })
      const decision = await request(app)
        .post(`/api/requests/${candidate.id}/transitions`)
        .set(admin.headers)
        .send({ to: 'DECISAO_FINAL' })
      expect(decision.status).toBe(200)
    }

    const approvals = await Promise.all(
      candidates.map(({ id }) =>
        request(app)
          .post(`/api/me/received-requests/${id}/transitions`)
          .set(admin.headers)
          .send({ to: 'APROVADA' }),
      ),
    )
    for (const response of approvals) expect(response.status).toBeLessThan(500)
    expect(approvals.map(({ status }) => status).sort()).toEqual([200, 409])

    const adoptions = await prisma.adoption.findMany({ where: { petId: pet.id } })
    expect(adoptions).toHaveLength(1)
    expect((await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).status).toBe('ADOTADO')
    const statuses = (
      await prisma.adoptionRequest.findMany({
        where: { id: { in: candidates.map(({ id }) => id) } },
      })
    ).map(({ status }) => status)
    expect(statuses.sort()).toEqual(['APROVADA', 'DECISAO_FINAL'])

    // Última linha de defesa: o índice único de Adoption.petId barra o segundo.
    const loser = candidates.find(({ id }) => id !== adoptions[0]?.requestId)
    expect(loser).toBeDefined()
    await expect(
      prisma.adoption.create({
        data: {
          requestId: loser!.id,
          petId: pet.id,
          adopterId: loser!.userId,
          organizationId: pet.organizationId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})
