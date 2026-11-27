import type { OrganizationRole } from '@adotapet/shared'
import type { Express } from 'express'
import { SignJWT } from 'jose'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { addMembership, bearer, makeRequest, makeUser, type Headers } from '../test/factories.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { prisma } from './db.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip

const ORGANIZATION_A = 'Instituição A (autorização)'
const ORGANIZATION_B = 'Instituição B (autorização)'
const PASSWORD = 'Senha@123'
type PlatformRole = 'USUARIO' | 'MODERADOR'

interface TokenOptions {
  platformRole?: PlatformRole
  claims?: Record<string, unknown>
  secret?: string
  expiresAt?: string | number
  issuedAt?: number
}

/**
 * Mesmo formato de `signAccessToken` (src/auth.ts), com claims extras para
 * simular uma alegação de papel dentro de um JWT validamente assinado. As
 * assinaturas inválidas/alg none já são cobertas por AUTH-09/AUTH-10; aqui a
 * chave de teste é usada de propósito para isolar o que cada claim autoriza.
 *
 * Divergência observada no código: `platformRole` do token é confiável para a
 * moderação (`requireModerator` lê `req.auth`), enquanto papel de organização
 * nunca vem do token — `demoRole`/`requireAbility` leem membership ativa.
 */
async function signToken(userId: string, options: TokenOptions = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    type: 'access',
    platformRole: options.platformRole ?? 'USUARIO',
    ...options.claims,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer('adotapet-api')
    .setAudience('adotapet-web')
    .setIssuedAt(options.issuedAt ?? now)
    .setExpirationTime(options.expiresAt ?? '15m')
    .sign(new TextEncoder().encode(options.secret ?? loadConfig().JWT_SECRET))
}

/** A factory de teste expõe makeUser/addMembership; este helper monta o GUARDIAN. */
async function makeGuardian(
  id: string,
  organizationName: string,
  role: OrganizationRole = 'ADMIN',
  platformRole: PlatformRole = 'USUARIO',
) {
  const created = await makeUser(id, {
    guardian: true,
    organizationName,
    organizationRole: role,
    platformRole,
  })
  const membership = await addMembership(created.user.id, organizationName, role)
  return { ...created, organizationId: membership.organizationId, organizationName }
}

async function invite(
  app: Express,
  headers: Headers,
  organizationId: string,
  email: string,
  role: 'ADMIN' | 'VOLUNTEER' = 'VOLUNTEER',
) {
  return request(app)
    .post(`/api/organizations/${organizationId}/invitations`)
    .set(headers)
    .send({ email, role })
}

const idsOf = (body: { data: Array<{ id: string }> }) => body.data.map((item) => item.id)

/**
 * Divergência das factories atuais: `makePet` não envia `createdAt`, campo
 * obrigatório no schema, e `makeAdoption` a reutiliza. Montamos aqui o mínimo
 * equivalente para não tocar em arquivos de teste compartilhados.
 */
async function makeTestPet(id: string, organizationId: string) {
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
      organizationId,
      createdAt: new Date(),
      status: 'DISPONIVEL',
    },
  })
}

async function makeTestAdoption(id: string, organizationId: string, adopterId: string) {
  const pet = await makeTestPet(`${id}-pet`, organizationId)
  const request = await makeRequest(`${id}-request`, adopterId, pet.id)
  const adoption = await prisma.adoption.create({
    data: { requestId: request.id, petId: pet.id, adopterId, organizationId },
  })
  await prisma.pet.update({ where: { id: pet.id }, data: { status: 'ADOTADO' } })
  return { adoption, pet, request }
}

databaseSuite('autorização ponta a ponta: escalada e matriz (PRIV/AUT)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    // App nova por teste: rate limit é estado local dos middlewares.
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[PRIV-01] claim organizationRole/role ADMIN em token assinado não cria ADMIN sem vínculo', async () => {
    const adminA = await makeGuardian('priv01-admin-a', ORGANIZATION_A)
    const common = await makeUser('priv01-common')
    const forged = bearer(
      await signToken(common.user.id, {
        claims: {
          organizationRole: 'ADMIN',
          role: 'ADMIN',
          roles: ['GUARDIAN'],
          organizationId: adminA.organizationId,
        },
      }),
    )

    const list = await request(app)
      .get(`/api/organizations/${adminA.organizationId}/invitations`)
      .set(forged)
    const create = await invite(
      app,
      forged,
      adminA.organizationId,
      'priv01-convidado@exemplo.com',
      'ADMIN',
    )
    const permissions = await request(app)
      .get(`/api/me/permissions?organizationId=${adminA.organizationId}`)
      .set(forged)

    for (const response of [list, create, permissions]) {
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
    }
    expect(
      await prisma.invitation.count({ where: { organizationId: adminA.organizationId } }),
    ).toBe(0)
  })

  it('[PRIV-02] platformRole alegado no token não herda poder de ADMIN da organização', async () => {
    const adminA = await makeGuardian('priv02-admin-a', ORGANIZATION_A)
    const common = await makeUser('priv02-common')
    const claimedModerator = bearer(
      await signToken(common.user.id, {
        platformRole: 'MODERADOR',
        claims: { organizationRole: 'ADMIN' },
      }),
    )

    // Divergência documentada: a alegação de platformRole em token assinado
    // vale para moderação; o mesmo claim não vale para a área da instituição.
    expect((await request(app).get('/api/moderation/reports').set(claimedModerator)).status).toBe(
      200,
    )
    for (const path of [
      `/api/organizations/${adminA.organizationId}/invitations`,
      `/api/me/permissions?organizationId=${adminA.organizationId}`,
      '/api/me/organization-pets',
      '/api/me/received-requests',
    ]) {
      expect((await request(app).get(path).set(claimedModerator)).status, path).toBe(403)
    }

    // ADMIN de organização (plataforma USUARIO) não modera; e MODERADOR real
    // da plataforma também não ganha ADMIN (extensão de RBAC-06).
    expect((await request(app).get('/api/moderation/reports').set(adminA.headers)).status).toBe(403)
    const moderator = await makeUser('priv02-moderator', { platformRole: 'MODERADOR' })
    expect((await request(app).get('/api/moderation/reports').set(moderator.headers)).status).toBe(
      200,
    )
    expect(
      (
        await request(app)
          .get(`/api/organizations/${adminA.organizationId}/invitations`)
          .set(moderator.headers)
      ).status,
    ).toBe(403)
  })

  it('[PRIV-03] sub define a identidade; claim userId alheio é ignorado', async () => {
    const adminA = await makeGuardian('priv03-admin-a', ORGANIZATION_A)
    const common = await makeUser('priv03-common')

    const withForeignUserId = bearer(
      await signToken(common.user.id, { claims: { userId: adminA.user.id, id: adminA.user.id } }),
    )
    const me = await request(app).get('/me').set(withForeignUserId)
    expect(me.status).toBe(200)
    expect(me.body.id).toBe(common.user.id)
    expect(me.body.id).not.toBe(adminA.user.id)
    expect(
      (
        await request(app)
          .get(`/api/organizations/${adminA.organizationId}/invitations`)
          .set(withForeignUserId)
      ).status,
    ).toBe(403)

    // Quem muda é o `sub` (escopo de quem possui a chave de assinatura): o
    // claim extra `userId` continuará sem efeito.
    const asAdmin = bearer(await signToken(adminA.user.id, { claims: { userId: common.user.id } }))
    expect((await request(app).get('/me').set(asAdmin)).body.id).toBe(adminA.user.id)
    expect(
      (
        await request(app)
          .get(`/api/organizations/${adminA.organizationId}/invitations`)
          .set(asAdmin)
      ).status,
    ).toBe(200)
  })

  it('[PRIV-04] organizações A e B ficam isoladas em listagens e detalhes', async () => {
    const adminA = await makeGuardian('priv04-admin-a', ORGANIZATION_A)
    const adminB = await makeGuardian('priv04-admin-b', ORGANIZATION_B)
    const adopter = await makeUser('priv04-adopter')
    const petA = await makeTestPet('priv04-pet-a', adminA.organizationId)
    const petB = await makeTestPet('priv04-pet-b', adminB.organizationId)
    const requestA = await makeRequest('priv04-request-a', adopter.user.id, petA.id)
    const requestB = await makeRequest('priv04-request-b', adopter.user.id, petB.id)
    const adoptionA = await makeTestAdoption(
      'priv04-adopt-a',
      adminA.organizationId,
      adopter.user.id,
    )
    const adoptionB = await makeTestAdoption(
      'priv04-adopt-b',
      adminB.organizationId,
      adopter.user.id,
    )
    const invitationA = await invite(
      app,
      adminA.headers,
      adminA.organizationId,
      'priv04-convidado-a@exemplo.com',
    )
    const invitationB = await invite(
      app,
      adminB.headers,
      adminB.organizationId,
      'priv04-convidado-b@exemplo.com',
    )
    expect(invitationA.status).toBe(201)
    expect(invitationB.status).toBe(201)

    // Pets: o detalhe público /api/pets/:id é aberto por contrato; o isolamento
    // vale para a listagem privada da instituição e para a escrita do pet.
    const pets = await request(app)
      .get(`/api/me/organization-pets?organizationId=${adminA.organizationId}`)
      .set(adminA.headers)
    expect(pets.status).toBe(200)
    const petIds = idsOf(pets.body)
    expect(petIds).toContain(petA.id)
    expect(petIds).not.toContain(petB.id)
    expect(petIds).not.toContain(adoptionB.pet.id)
    expect(
      (
        await request(app)
          .get(`/api/me/organization-pets?organizationId=${adminB.organizationId}`)
          .set(adminA.headers)
      ).status,
    ).toBe(403)

    // Solicitações: fila da A não mostra a B, nem o detalhe privilegiado dela.
    const requests = await request(app)
      .get(`/api/me/received-requests?organizationId=${adminA.organizationId}`)
      .set(adminA.headers)
    expect(requests.status).toBe(200)
    const requestIds = idsOf(requests.body)
    expect(requestIds).toContain(requestA.id)
    expect(requestIds).not.toContain(requestB.id)
    expect(
      (await request(app).get(`/api/me/received-requests/${requestB.id}`).set(adminA.headers))
        .status,
    ).toBe(404)
    expect(
      (await request(app).get(`/api/requests/${requestB.id}`).set(adminA.headers)).status,
    ).toBe(403)
    expect(
      (await request(app).get(`/api/requests/${requestA.id}`).set(adopter.headers)).status,
    ).toBe(200)

    // Adoções: listagem por organização e escrita do plano de acompanhamento.
    const adoptions = await request(app)
      .get(`/api/organizations/${adminA.organizationId}/adoptions`)
      .set(adminA.headers)
    expect(adoptions.status).toBe(200)
    const adoptionIds = idsOf(adoptions.body)
    expect(adoptionIds).toContain(adoptionA.adoption.id)
    expect(adoptionIds).not.toContain(adoptionB.adoption.id)
    expect(
      (
        await request(app)
          .get(`/api/organizations/${adminB.organizationId}/adoptions`)
          .set(adminA.headers)
      ).status,
    ).toBe(403)
    const foreignPlan = await request(app)
      .post(`/api/adoptions/${adoptionB.adoption.id}/follow-up-plan`)
      .set(adminA.headers)
      .send({ durationDays: 30, intervalDays: 7 })
    expect(foreignPlan.status).toBe(403)

    // Convites e detalhe da organização: ADMIN da A não entra na B.
    const invitations = await request(app)
      .get(`/api/organizations/${adminA.organizationId}/invitations`)
      .set(adminA.headers)
    expect(invitations.status).toBe(200)
    const invitationIds = idsOf(invitations.body)
    expect(invitationIds).toContain(invitationA.body.id)
    expect(invitationIds).not.toContain(invitationB.body.id)
    expect(
      (
        await request(app)
          .get(`/api/organizations/${adminB.organizationId}/invitations`)
          .set(adminA.headers)
      ).status,
    ).toBe(403)
    expect(
      (await request(app).get(`/api/organizations/${adminB.organizationId}`).set(adminA.headers))
        .status,
    ).toBe(403)
    expect(
      (
        await invite(
          app,
          adminA.headers,
          adminB.organizationId,
          'priv04-invasor@exemplo.com',
          'ADMIN',
        )
      ).status,
    ).toBe(403)
    expect(
      await prisma.invitation.count({ where: { organizationId: adminB.organizationId } }),
    ).toBe(1)
  })

  it('[PRIV-05] role do convite vem do corpo, mas só ADMIN daquela organização pode escolhê-la', async () => {
    const adminA = await makeGuardian('priv05-admin-a', ORGANIZATION_A)
    const adminB = await makeGuardian('priv05-admin-b', ORGANIZATION_B)
    const volunteer = await makeGuardian('priv05-volunteer', ORGANIZATION_A, 'VOLUNTEER')
    const invited = await makeUser('priv05-invited')

    const fromVolunteer = await invite(
      app,
      volunteer.headers,
      adminA.organizationId,
      invited.user.email,
      'ADMIN',
    )
    expect(fromVolunteer.status).toBe(403)
    expect(
      await prisma.invitation.count({ where: { organizationId: adminA.organizationId } }),
    ).toBe(0)

    const created = await invite(
      app,
      adminA.headers,
      adminA.organizationId,
      invited.user.email,
      'ADMIN',
    )
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      role: 'ADMIN',
      organizationId: adminA.organizationId,
      status: 'PENDENTE',
    })
    expect(
      (
        await invite(
          app,
          adminA.headers,
          adminB.organizationId,
          'priv05-cross@exemplo.com',
          'ADMIN',
        )
      ).status,
    ).toBe(403)
    expect(
      await prisma.invitation.count({ where: { organizationId: adminB.organizationId } }),
    ).toBe(0)

    const accepted = await request(app).post(created.body.acceptUrl).set(invited.headers)
    expect(accepted.status).toBe(200)
    const membership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: {
          userId: invited.user.id,
          organizationId: adminA.organizationId,
        },
      },
    })
    expect(membership.role).toBe('ADMIN')
    expect(
      (
        await request(app)
          .get(`/api/organizations/${adminB.organizationId}/invitations`)
          .set(invited.headers)
      ).status,
    ).toBe(403)
  })

  it('[AUT-01] rotas privadas e de administração sem token respondem 401', async () => {
    const adminA = await makeGuardian('aut01-admin-a', ORGANIZATION_A)
    const paths = [
      '/me',
      '/api/auth/me',
      '/api/me',
      '/api/me/account',
      '/api/me/permissions',
      '/api/me/organization-pets',
      '/api/me/received-requests',
      '/api/me/adoptions',
      '/api/requests',
      `/api/organizations/${adminA.organizationId}`,
      `/api/organizations/${adminA.organizationId}/invitations`,
      `/api/organizations/${adminA.organizationId}/adoptions`,
      '/api/moderation/reports',
    ]
    for (const path of paths) {
      const response = await request(app).get(path)
      expect(response.status, path).toBe(401)
      expect(response.body, path).toMatchObject({ statusCode: 401, error: 'Unauthorized' })
    }

    const adminPost = await request(app)
      .post(`/api/organizations/${adminA.organizationId}/invitations`)
      .send({ email: 'aut01@exemplo.com', role: 'ADMIN' })
    expect(adminPost.status).toBe(401)
  })

  it('[AUT-02] usuário comum recebe 403 nas rotas de administração', async () => {
    const adminA = await makeGuardian('aut02-admin-a', ORGANIZATION_A)
    const common = await makeUser('aut02-common')
    const organizationPath = `/api/organizations/${adminA.organizationId}`
    const responses = await Promise.all([
      request(app).get(`${organizationPath}/invitations`).set(common.headers),
      request(app)
        .post(`${organizationPath}/invitations`)
        .set(common.headers)
        .send({ email: 'aut02-convidado@exemplo.com', role: 'ADMIN' }),
      request(app)
        .get(`/api/me/permissions?organizationId=${adminA.organizationId}`)
        .set(common.headers),
      request(app).get(`${organizationPath}/adoptions`).set(common.headers),
      request(app).get(organizationPath).set(common.headers),
      request(app).get('/api/moderation/reports').set(common.headers),
    ])
    for (const response of responses) {
      expect(response.status).toBe(403)
      expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
    }
  })

  it('[AUT-03] ADMIN com vínculo ativo acessa as rotas autorizadas', async () => {
    const adminA = await makeGuardian('aut03-admin-a', ORGANIZATION_A)
    const permissions = await request(app)
      .get(`/api/me/permissions?organizationId=${adminA.organizationId}`)
      .set(adminA.headers)
    expect(permissions.status).toBe(200)
    expect(permissions.body).toMatchObject({ role: 'ADMIN', canApprove: true })

    const organization = await request(app)
      .get(`/api/organizations/${adminA.organizationId}`)
      .set(adminA.headers)
    expect(organization.status).toBe(200)
    const invitations = await request(app)
      .get(`/api/organizations/${adminA.organizationId}/invitations`)
      .set(adminA.headers)
    expect(invitations.status).toBe(200)
    const pets = await request(app)
      .get(`/api/me/organization-pets?organizationId=${adminA.organizationId}`)
      .set(adminA.headers)
    expect(pets.status).toBe(200)
    const requests = await request(app)
      .get(`/api/me/received-requests?organizationId=${adminA.organizationId}`)
      .set(adminA.headers)
    expect(requests.status).toBe(200)
  })

  it('[AUT-04] access token expirado é 401 em rota privada e em rota de admin', async () => {
    const adminA = await makeGuardian('aut04-admin-a', ORGANIZATION_A)
    const now = Math.floor(Date.now() / 1000)
    const expired = bearer(
      await signToken(adminA.user.id, { issuedAt: now - 3_600, expiresAt: now - 1_800 }),
    )
    for (const path of [
      '/me',
      `/api/organizations/${adminA.organizationId}/invitations`,
      '/api/moderation/reports',
    ]) {
      const response = await request(app).get(path).set(expired)
      expect(response.status, path).toBe(401)
      expect(response.body.error).toBe('Unauthorized')
    }
  })

  it('[AUT-05] assinatura errada e claims de access inválidos são 401', async () => {
    const adminA = await makeGuardian('aut05-admin-a', ORGANIZATION_A)
    const paths = ['/me', `/api/organizations/${adminA.organizationId}/invitations`]

    const wrongKey = bearer(
      await signToken(adminA.user.id, {
        secret: 'chave-errada-com-mais-de-32-caracteres-para-teste',
      }),
    )
    const wrongType = bearer(await signToken(adminA.user.id, { claims: { type: 'refresh' } }))
    const valid = await signToken(adminA.user.id)
    const [header, payload, signature] = valid.split('.')
    const tampered = bearer(
      `${header}.${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`,
    )

    for (const headers of [wrongKey, wrongType, tampered]) {
      for (const path of paths) {
        const response = await request(app).get(path).set(headers)
        expect(response.status, path).toBe(401)
        expect(response.body.error).toBe('Unauthorized')
      }
    }
  })

  it('[AUT-06] cookie de refresh sozinho não autentica rotas privadas', async () => {
    const registered = await request(app).post('/api/auth/register').send({
      name: 'Ana Souza',
      email: 'aut06@exemplo.com',
      password: PASSWORD,
    })
    expect(registered.status).toBe(201)
    const cookies = registered.headers['set-cookie'] as unknown as string[] | undefined
    const cookie = cookies?.find((value) => value.startsWith('refresh_token='))
    expect(cookie).toBeTruthy()

    for (const path of [
      '/me',
      '/api/moderation/reports',
      '/api/organizations/inexistente/invitations',
    ]) {
      const response = await request(app)
        .get(path)
        .set('Cookie', cookie as string)
      expect(response.status, path).toBe(401)
    }
    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie as string)
    expect(refreshed.status).toBe(200)
    // O access token emitido pelo refresh funciona; o cookie sozinho, não.
    expect((await request(app).get('/me').set(bearer(refreshed.body.accessToken))).status).toBe(200)
    expect(
      (
        await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', cookie as string)
      ).status,
    ).toBe(401)
  })

  it('[AUT-07] duas linhas concretas da matriz coincidem com as rotas', async () => {
    const admin = await makeGuardian('aut07-admin-a', ORGANIZATION_A)
    const volunteer = await makeGuardian('aut07-volunteer', ORGANIZATION_A, 'VOLUNTEER')
    const adopter = await makeUser('aut07-adopter')
    const moderator = await makeUser('aut07-moderator', { platformRole: 'MODERADOR' })
    const headers = [admin.headers, volunteer.headers, adopter.headers, moderator.headers]

    // "Gerenciar membros e convites": ✅ ADMIN / ❌ demais.
    const invitationStatuses = await Promise.all(
      headers.map(
        async (item) =>
          (
            await request(app)
              .get(`/api/organizations/${admin.organizationId}/invitations`)
              .set(item)
          ).status,
      ),
    )
    expect(invitationStatuses).toEqual([200, 403, 403, 403])

    // "Moderar denúncias": ✅ MODERADOR da plataforma / ❌ demais.
    const moderationStatuses = await Promise.all(
      headers.map(
        async (item) => (await request(app).get('/api/moderation/reports').set(item)).status,
      ),
    )
    expect(moderationStatuses).toEqual([403, 403, 403, 200])
  })
})
