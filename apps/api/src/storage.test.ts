import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { ensureTestOrganization } from '../test/organization.js'
import { startTestStorage, type TestStorage } from '../test/storage-server.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import {
  buildObjectKey,
  getStorageProvider,
  S3StorageProvider,
  setStorageProvider,
  signObjectUrl,
  storageConfigFromConfig,
} from './storage.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

/** PNG 1x1 válido: a assinatura, não a extensão, decide o tipo. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)
const EXECUTABLE = Buffer.from('7f454c4602010100000000000000000002003e0001000000', 'hex')

let storage: TestStorage
let secondStorage: TestStorage

beforeAll(async () => {
  storage = await startTestStorage('adotapet-test')
  secondStorage = await startTestStorage('adotapet-other')
  process.env.STORAGE_ENDPOINT = storage.endpoint
  process.env.STORAGE_REGION = 'us-east-1'
  process.env.STORAGE_BUCKET = storage.bucket
  process.env.STORAGE_ACCESS_KEY_ID = storage.accessKeyId
  process.env.STORAGE_SECRET_ACCESS_KEY = storage.secretAccessKey
  process.env.STORAGE_FORCE_PATH_STYLE = 'true'
  process.env.STORAGE_SIGNED_URL_TTL_SECONDS = '60'
  setStorageProvider(null)
})

afterAll(async () => {
  setStorageProvider(null)
  await storage?.close()
  await secondStorage?.close()
})

async function makeUser(id: string, guardian = false) {
  const user = await prisma.user.create({
    data: {
      id,
      name: guardian ? 'Equipe Patinhas' : 'Ana Souza',
      email: `${id}@exemplo.com`,
      platformRole: guardian ? 'MODERADOR' : 'USUARIO',
      role: guardian ? 'GUARDIAN' : 'ADOTANTE',
      roles: guardian ? ['GUARDIAN'] : [],
      organizationName: guardian ? 'Instituição Patinhas' : null,
    },
  })
  if (guardian) {
    await prisma.guardianProfile.create({
      data: {
        userId: id,
        guardianType: 'ORGANIZATION',
        displayName: 'Instituição Patinhas',
        legalName: 'Instituição Patinhas',
        document: '12.345.678/0001-90',
        email: `${id}@exemplo.com`,
        phone: '(11) 3333-4444',
        zipCode: '01310-100',
        address: 'Avenida Paulista, 1000',
        city: 'São Paulo',
        description: 'Organização de proteção animal',
        acceptsTerms: true,
      },
    })
    const organization = await ensureTestOrganization('Instituição Patinhas', 'IP')
    await prisma.membership.create({
      data: { userId: id, organizationId: organization.id, role: 'ADMIN', status: 'ATIVO' },
    })
  }
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makePet(id: string) {
  const organization = await ensureTestOrganization('Instituição Patinhas', 'IP')
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
      organizationId: organization.id,
      createdAt: new Date(),
    },
  })
}

function upload(
  app: Express,
  headers: Record<string, string>,
  options: { resourceType?: string; resourceId?: string; files?: Array<[Buffer, string]> } = {},
) {
  let call = request(app)
    .post('/api/storage/objects')
    .set(headers)
    .field('scope', 'petPhoto')
    .field('resourceType', options.resourceType ?? 'PET')
    .field('resourceId', options.resourceId ?? 'pet-sto')
  for (const [body, name] of options.files ?? [[PNG, 'foto.png']]) {
    call = call.attach('files', body, name)
  }
  return call
}

databaseSuite('armazenamento de arquivos (#94)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  it('[STO-01] upload e download pela API S3', async () => {
    const { headers } = await makeUser('sto-01-user')
    const response = await upload(app, headers)
    expect(response.status).toBe(201)
    expect(response.body.total).toBe(1)

    const object = response.body.data[0]
    const signed = await request(app).get(object.url)
    expect(signed.status).toBe(200)
    expect(Buffer.compare(signed.body, PNG)).toBe(0)

    // Download direto pela API S3 (presigner) prova que o provider fala S3.
    const url = await getStorageProvider().presignGet(object.key, 60)
    const direct = await fetch(url)
    expect(direct.status).toBe(200)
    expect(Buffer.compare(Buffer.from(await direct.arrayBuffer()), PNG)).toBe(0)
  })

  it('[STO-02] bucket privado: sem assinatura retorna 403', async () => {
    const { headers } = await makeUser('sto-02-user')
    const uploaded = await upload(app, headers)
    const { id } = uploaded.body.data[0]

    expect((await request(app).get(`/files/${id}`)).status).toBe(403)
    expect((await request(app).get(`/files/${id}?token=invalido`)).status).toBe(403)
  })

  it('[STO-03] URL assinada expira', async () => {
    const { headers } = await makeUser('sto-03-user')
    const uploaded = await upload(app, headers)
    const { id } = uploaded.body.data[0]
    const config = loadConfig()
    const expired = await signObjectUrl(id, -10, config.STORAGE_URL_SECRET ?? config.JWT_SECRET)

    expect((await request(app).get(expired.url)).status).toBe(403)
  })

  it('[STO-04] tipo pelo conteúdo, tamanho e quantidade validados', async () => {
    const { headers } = await makeUser('sto-04-user')

    const executable = await upload(app, headers, { files: [[EXECUTABLE, 'foto.png']] })
    expect(executable.status).toBe(400)

    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)])
    const oversized = await upload(app, headers, { files: [[big, 'grande.png']] })
    expect(oversized.status).toBe(400)

    const many = await upload(app, headers, {
      files: Array.from({ length: 9 }, () => [PNG, 'foto.png'] as [Buffer, string]),
    })
    expect(many.status).toBe(400)
  })

  it('[STO-05] nome do objeto gerado pelo servidor', async () => {
    const { headers } = await makeUser('sto-05-user')
    const response = await upload(app, headers, {
      files: [[PNG, '../../../etc/passwd.png']],
    })
    expect(response.status).toBe(201)

    const key = response.body.data[0].key as string
    expect(key.startsWith('pets/')).toBe(true)
    expect(key).not.toContain('..')
    expect(key).not.toContain('passwd')
    expect(key).toMatch(/^pets\/[0-9a-f-]{36}\.png$/)
  })

  it('[STO-06] sem vínculo e sem URL assinada não acessa objeto alheio', async () => {
    const owner = await makeUser('sto-06-owner')
    const outsider = await makeUser('sto-06-outsider')
    const other = await makeUser('sto-06-other')
    const uploaded = await upload(app, owner.headers)
    const object = uploaded.body.data[0]
    const otherUpload = await upload(app, other.headers)
    const otherId = otherUpload.body.data[0].id

    expect(
      (await request(app).post(`/api/storage/objects/${object.id}/url`).set(outsider.headers))
        .status,
    ).toBe(403)

    const config = loadConfig()
    const token = await signObjectUrl(object.id, 60, config.STORAGE_URL_SECRET ?? config.JWT_SECRET)
    const tampered = token.url.replace(object.id, otherId)
    expect((await request(app).get(tampered)).status).toBe(403)
  })

  it('[STO-07] trocar provedor é só variável de ambiente', async () => {
    const overridden = loadConfig({
      ...process.env,
      STORAGE_ENDPOINT: secondStorage.endpoint,
      STORAGE_BUCKET: secondStorage.bucket,
    })
    const config = storageConfigFromConfig(overridden)
    expect(config.endpoint).toBe(secondStorage.endpoint)
    expect(config.bucket).toBe(secondStorage.bucket)

    const provider = new S3StorageProvider(config)
    await provider.ensureBucket()
    const key = buildObjectKey('pets', 'image/png')
    const original = getStorageProvider()

    await original.putObject({ key, body: PNG, contentType: 'image/png' })
    expect(await provider.objectExists(key)).toBe(false)
    await provider.putObject({ key, body: PNG, contentType: 'image/png' })
    expect(await provider.getObject(key)).toMatchObject({
      contentType: 'image/png',
      sizeBytes: PNG.length,
    })
  })

  it('[STO-08] apagar o registro remove o objeto', async () => {
    const guardian = await makeUser('sto-08-guardian', true)
    const pet = await makePet('sto-08-pet')
    const uploaded = await upload(app, guardian.headers, { resourceId: pet.id })
    expect(uploaded.status).toBe(201)
    const { key, id } = uploaded.body.data[0]

    const response = await request(app)
      .delete(`/api/me/organization-pets/${pet.id}`)
      .set(guardian.headers)
    expect(response.status).toBe(204)
    expect(await getStorageProvider().objectExists(key)).toBe(false)
    expect(await prisma.storageObject.findUnique({ where: { id } })).toBeNull()
  })

  it('[STO-09] arquivos servidos sem execução', async () => {
    const { headers } = await makeUser('sto-09-user')
    const uploaded = await upload(app, headers)
    const response = await request(app).get(uploaded.body.data[0].url)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/^image\/png/)
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })
})
