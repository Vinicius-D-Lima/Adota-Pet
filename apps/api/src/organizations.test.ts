import { createHash } from 'node:crypto'
import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

async function makeUser(id: string, email = `${id}@exemplo.com`) {
  const user = await prisma.user.create({
    data: { id, name: `Usuário ${id}`, email: email.toLowerCase(), role: 'ADOTANTE' },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

const organizationBody = (suffix: string) => ({
  name: `Organização ${suffix}`,
  initials: `O${suffix.slice(0, 2)}`,
  description: 'Organização dedicada à proteção e adoção responsável de animais.',
  city: 'São Paulo, SP',
  contactEmail: `contato-${suffix}@exemplo.com`,
  phone: '11999990000',
})

async function createOrganization(app: Express, headers: Record<string, string>, suffix: string) {
  const response = await request(app)
    .post('/api/organizations')
    .set(headers)
    .send(organizationBody(suffix))
  expect(response.status).toBe(201)
  return response.body as { id: string; name: string }
}

async function invite(
  app: Express,
  headers: Record<string, string>,
  organizationId: string,
  email: string,
  role: 'ADMIN' | 'VOLUNTEER' = 'VOLUNTEER',
) {
  return request(app)
    .post(`/api/organizations/${organizationId}/invitations`)
    .set(headers)
    .send({ email, role })
}

const tokenFrom = (acceptUrl: string) => acceptUrl.split('/').at(-2) as string

async function makePet(id: string, organizationId: string) {
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
      specialCare: false,
      vaccinated: true,
      neutered: true,
      organizationId,
      createdAt: new Date(),
    },
  })
}

databaseSuite('organizações, membros e convites (#27)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    await resetTestDatabase()
  })

  it('[ORG-01] quem cria a organização vira administrador', async () => {
    const creator = await makeUser('org-01-creator')
    const organization = await createOrganization(app, creator.headers, '01')

    const membership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: {
          userId: creator.user.id,
          organizationId: organization.id,
        },
      },
    })
    expect(membership).toMatchObject({ role: 'ADMIN', status: 'ATIVO' })
  })

  it('[ORG-02] a organização mantém ao menos um administrador', async () => {
    const creator = await makeUser('org-02-creator')
    const organization = await createOrganization(app, creator.headers, '02')

    const demote = await request(app)
      .patch(`/api/organizations/${organization.id}/members/${creator.user.id}`)
      .set(creator.headers)
      .send({ role: 'VOLUNTEER' })
    expect(demote.status).toBe(409)

    const remove = await request(app)
      .delete(`/api/organizations/${organization.id}/members/${creator.user.id}`)
      .set(creator.headers)
    expect(remove.status).toBe(409)
    expect(
      await prisma.membership.count({
        where: { organizationId: organization.id, role: 'ADMIN', status: 'ATIVO' },
      }),
    ).toBe(1)
  })

  it('[ORG-03] convite expirado, revogado ou já usado é rejeitado', async () => {
    const admin = await makeUser('org-03-admin')
    const expiredUser = await makeUser('org-03-expired')
    const revokedUser = await makeUser('org-03-revoked')
    const usedUser = await makeUser('org-03-used')
    const organization = await createOrganization(app, admin.headers, '03')

    const expiredInvite = await invite(app, admin.headers, organization.id, expiredUser.user.email)
    await prisma.invitation.update({
      where: { id: expiredInvite.body.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })
    expect(
      (
        await request(app)
          .post(`/api/invitations/${tokenFrom(expiredInvite.body.acceptUrl)}/accept`)
          .set(expiredUser.headers)
      ).status,
    ).toBe(410)

    const revokedInvite = await invite(app, admin.headers, organization.id, revokedUser.user.email)
    expect(
      (
        await request(app)
          .delete(`/api/organizations/${organization.id}/invitations/${revokedInvite.body.id}`)
          .set(admin.headers)
      ).status,
    ).toBe(204)
    expect(
      (
        await request(app)
          .post(`/api/invitations/${tokenFrom(revokedInvite.body.acceptUrl)}/accept`)
          .set(revokedUser.headers)
      ).status,
    ).toBe(410)

    const usedInvite = await invite(app, admin.headers, organization.id, usedUser.user.email)
    const acceptUrl = usedInvite.body.acceptUrl as string
    expect((await request(app).post(acceptUrl).set(usedUser.headers)).status).toBe(200)
    expect((await request(app).post(acceptUrl).set(usedUser.headers)).status).toBe(400)
  })

  it('[ORG-04] convite só pode ser aceito pela conta convidada', async () => {
    const admin = await makeUser('org-04-admin')
    const invited = await makeUser('org-04-invited')
    const outsider = await makeUser('org-04-outsider')
    const organization = await createOrganization(app, admin.headers, '04')
    const invitation = await invite(app, admin.headers, organization.id, invited.user.email)

    const response = await request(app).post(invitation.body.acceptUrl).set(outsider.headers)
    expect(response.status).toBe(403)
    expect(
      await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: outsider.user.id,
            organizationId: organization.id,
          },
        },
      }),
    ).toBeNull()
  })

  it('[ORG-05] token de convite tem alta entropia e só o hash é persistido', async () => {
    const admin = await makeUser('org-05-admin')
    const organization = await createOrganization(app, admin.headers, '05')
    const response = await invite(app, admin.headers, organization.id, 'convidado-05@exemplo.com')
    expect(response.status).toBe(201)

    const token = tokenFrom(response.body.acceptUrl)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: response.body.id } })
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(JSON.stringify(stored)).not.toContain(token)
    expect(response.body).not.toHaveProperty('tokenHash')
  })

  it('[ORG-06] só ADMIN convida, remove membros e altera papéis', async () => {
    const admin = await makeUser('org-06-admin')
    const volunteer = await makeUser('org-06-volunteer')
    const adopter = await makeUser('org-06-adopter')
    const organization = await createOrganization(app, admin.headers, '06')
    await prisma.membership.create({
      data: {
        userId: volunteer.user.id,
        organizationId: organization.id,
        role: 'VOLUNTEER',
        status: 'ATIVO',
      },
    })

    expect(
      (await invite(app, volunteer.headers, organization.id, 'alvo-06@exemplo.com')).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .patch(`/api/organizations/${organization.id}/members/${admin.user.id}`)
          .set(volunteer.headers)
          .send({ role: 'VOLUNTEER' })
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .delete(`/api/organizations/${organization.id}/members/${admin.user.id}`)
          .set(volunteer.headers)
      ).status,
    ).toBe(403)
    expect(
      (await invite(app, adopter.headers, organization.id, 'alvo-2-06@exemplo.com')).status,
    ).toBe(403)
  })

  it('[ORG-07] pets usam chave estrangeira para uma organização real', async () => {
    const creator = await makeUser('org-07-creator')
    const organization = await createOrganization(app, creator.headers, '07')
    const pet = await makePet('org-07-pet', organization.id)
    const persisted = await prisma.pet.findUniqueOrThrow({
      where: { id: pet.id },
      include: { organizationEntity: true },
    })

    expect(persisted.organizationId).toBe(organization.id)
    expect(persisted.organizationEntity.name).toBe(organization.name)
    await expect(prisma.organization.delete({ where: { id: organization.id } })).rejects.toThrow()
  })

  it('[ORG-08] membros de uma organização não acessam nem alteram outra', async () => {
    const adminA = await makeUser('org-08-admin-a')
    const adminB = await makeUser('org-08-admin-b')
    const organizationA = await createOrganization(app, adminA.headers, '08-a')
    const organizationB = await createOrganization(app, adminB.headers, '08-b')

    expect(
      (await request(app).get(`/api/organizations/${organizationB.id}`).set(adminA.headers)).status,
    ).toBe(403)
    expect(
      (await request(app).get(`/api/organizations/${organizationB.id}/members`).set(adminA.headers))
        .status,
    ).toBe(403)
    expect(
      (await invite(app, adminA.headers, organizationB.id, 'alvo-08@exemplo.com')).status,
    ).toBe(403)
    expect(
      await prisma.membership.count({
        where: { userId: adminA.user.id, organizationId: organizationA.id, status: 'ATIVO' },
      }),
    ).toBe(1)
  })

  it('[ORG-09] convite expira exatamente em sete dias', async () => {
    const admin = await makeUser('org-09-admin')
    const organization = await createOrganization(app, admin.headers, '09')
    const now = new Date('2026-11-23T15:00:00.000Z')
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime())

    const response = await invite(app, admin.headers, organization.id, 'convidado-09@exemplo.com')
    expect(response.status).toBe(201)
    expect(new Date(response.body.expiresAt).getTime() - now.getTime()).toBe(
      7 * 24 * 60 * 60 * 1_000,
    )
  })
})
