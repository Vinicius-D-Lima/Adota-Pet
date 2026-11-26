import { readFileSync } from 'node:fs'
import type { OrganizationRole } from '@adotapet/shared'
import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { ensureTestOrganization } from '../test/organization.js'
import { resetTestDatabase } from '../test/reset.js'
import {
  MATRIX_CHECKS,
  MATRIX_ROLES,
  abilityForMatrixRole,
  createAbility,
  matrixRuleTargets,
} from './ability.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
type Headers = Record<string, string>

const ADOPTER_PROFILE = {
  name: 'Ana Souza',
  cpf: '529.982.247-25',
  birthDate: '1990-05-10',
  email: 'ana@exemplo.com',
  phone: '(11) 98888-7777',
  zipCode: '01310-100',
  address: 'Avenida Paulista, 1000',
  housing: 'Apartamento',
  hasOutdoorArea: false,
  dailyTime: 'Até 1 hora',
  activityLevel: 'Tranquilo',
  hasChildren: false,
  hasOtherPets: false,
  experience: 'Primeiro pet',
  acceptsSpecialCare: false,
  preferredSpecies: 'Cachorro',
  preferredSize: 'Médio ou grande',
} as const

const ANSWERS = {
  motivation: 'Quero oferecer um lar seguro e cheio de carinho para este pet.',
  routine: 'Trabalho em casa e faço caminhadas diárias no parque do bairro.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço tranquilo e apresentar a rotina aos poucos.',
  costs: true,
  commitment: true,
} as const

const completedInterview = {
  type: 'Entrevista online',
  proposedSlots: [new Date(Date.now() + 86_400_000).toISOString()],
  status: 'REALIZADA',
  completed: true,
  scheduledAt: new Date(Date.now() - 86_400_000).toISOString(),
  completedAt: new Date().toISOString(),
} as const

interface CreatedUser {
  id: string
  headers: Headers
}

interface UserOptions {
  guardian?: boolean
  organizationRole?: OrganizationRole
  platformRole?: 'USUARIO' | 'MODERADOR'
}

async function makeUser(id: string, options: UserOptions = {}): Promise<CreatedUser> {
  const guardian = options.guardian ?? false
  const user = await prisma.user.create({
    data: {
      id,
      name: guardian ? 'Equipe da instituição' : 'Adotante de teste',
      email: `${id}@exemplo.com`,
      role: guardian ? 'GUARDIAN' : 'ADOTANTE',
      roles: guardian ? ['GUARDIAN'] : [],
      organizationRole: options.organizationRole ?? 'ADMIN',
      platformRole: options.platformRole ?? 'USUARIO',
    },
  })
  const { token } = await signAccessToken(user)
  return { id: user.id, headers: bearer(token) }
}

async function makeGuardian(
  id: string,
  role: OrganizationRole = 'ADMIN',
  organizationId?: string,
): Promise<CreatedUser & { organizationId: string }> {
  const created = await makeUser(id, { guardian: true, organizationRole: role })
  const organization = organizationId
    ? await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    : await ensureTestOrganization(`Organização ${id}`, id.slice(0, 2).toUpperCase())
  await prisma.membership.create({
    data: { userId: id, organizationId: organization.id, role, status: 'ATIVO' },
  })
  return { ...created, organizationId: organization.id }
}

async function makeAdopter(id: string): Promise<CreatedUser> {
  const created = await makeUser(id)
  await prisma.adopterProfile.create({ data: { userId: id, ...ADOPTER_PROFILE } })
  return created
}

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
      organizationId,
      createdAt: new Date(),
      status: 'DISPONIVEL',
    },
  })
}

async function makeRequest(
  id: string,
  petId: string,
  adopterId: string,
  status: string,
  interview?: object,
) {
  return prisma.adoptionRequest.create({
    data: {
      id,
      petId,
      userId: adopterId,
      status,
      date: new Date(),
      message: 'Solicitação em análise.',
      answers: ANSWERS,
      ...(interview ? { interview } : {}),
    },
  })
}

const petPayload = (name: string) => ({
  name,
  species: 'Cachorro',
  breed: 'SRD',
  age: 3,
  size: 'Médio',
  sex: 'Macho',
  city: 'São Paulo',
  image: 'https://example.com/pet-editado.jpg',
  summary: 'Resumo atualizado do pet para edição.',
  description: 'Descrição atualizada do pet após a edição feita pela instituição.',
  traits: ['Calmo'],
  energy: 'Moderada',
  space: 'Apartamento',
  children: true,
  otherPets: true,
})

describe('matriz de permissões: fonte única', () => {
  it('[RBAC-01] cada célula ✅/❌ da matriz é aplicada pelas regras CASL', () => {
    let checked = 0
    for (const role of MATRIX_ROLES) {
      const ability = abilityForMatrixRole(role)
      for (const check of MATRIX_CHECKS) {
        const expected = check.cells[role]
        if (expected === null) continue
        for (const rule of matrixRuleTargets(check)) {
          expect(
            ability.can(rule.action, rule.target),
            `${role} / ${check.action} / ${rule.action} ${rule.subject}`,
          ).toBe(expected)
          checked += 1
        }
      }
    }
    // 8 linhas com ✅/❌ para todos os papéis + 1 linha só de ADOTANTE.
    expect(checked).toBeGreaterThanOrEqual(30)
  })

  it('[RBAC-09] a matriz do README coincide com as regras CASL', () => {
    const readme = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')
    const section = readme
      .split('### Matriz de permissões (CASL)')[1]
      ?.split('### 2) Frontend + mock-server (sem banco)')[0]
    expect(section, 'README precisa conter a seção da matriz').toBeTruthy()
    const lines = (section ?? '')
      .split('\n')
      .filter((line) => line.trim().startsWith('|'))
      .slice(2)
    expect(lines).toHaveLength(MATRIX_CHECKS.length)

    lines.forEach((line, index) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/\*\*/g, ''))
      const check = MATRIX_CHECKS[index]
      expect(cells[0]).toBe(check.action)

      MATRIX_ROLES.forEach((role, column) => {
        const symbol = cells[column + 1]
        const fromReadme = symbol === '✅' ? true : symbol === '❌' ? false : null
        const expected = check.cells[role]
        expect(fromReadme, `${check.action} / ${role}`).toBe(expected)
        if (expected === null) {
          expect(['–', '-', ''], `${check.action} / ${role} deve usar “–”`).toContain(symbol)
          return
        }
        const ability = abilityForMatrixRole(role)
        for (const rule of matrixRuleTargets(check)) {
          expect(
            ability.can(rule.action, rule.target),
            `${check.action} / ${role} / ${rule.action} ${rule.subject}`,
          ).toBe(fromReadme)
        }
      })
    })
  })
})

databaseSuite('autorização nos endpoints da instituição (#28)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[RBAC-02] voluntário tentando aprovar uma adoção recebe 403', async () => {
    const volunteer = await makeGuardian('rbac02-volunteer', 'VOLUNTEER')
    const adopter = await makeAdopter('rbac02-adopter')
    await makePet('rbac02-pet', volunteer.organizationId)
    await makeRequest(
      'rbac02-request',
      'rbac02-pet',
      adopter.id,
      'ANALISE_QUESTIONARIO',
      completedInterview,
    )

    const response = await request(app)
      .post('/api/me/received-requests/rbac02-request/transitions')
      .set(volunteer.headers)
      .send({ to: 'APROVADA' })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
    const unchanged = await prisma.adoptionRequest.findUniqueOrThrow({
      where: { id: 'rbac02-request' },
    })
    expect(unchanged.status).toBe('ANALISE_QUESTIONARIO')
  })

  it('[RBAC-03] membro da organização A não edita pet da organização B', async () => {
    const memberA = await makeGuardian('rbac03-member-a')
    const organizationB = await ensureTestOrganization('Organização RBAC-03 B', 'RB')
    await makePet('rbac03-pet-b', organizationB.id)

    const response = await request(app)
      .put('/api/me/organization-pets/rbac03-pet-b')
      .set(memberA.headers)
      .send(petPayload('Pet editado sem permissão'))

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
  })

  it('[RBAC-04] /me/permissions reflete mudança de papel sem novo login', async () => {
    const member = await makeGuardian('rbac04-member')
    const permissions = () =>
      request(app)
        .get(`/api/me/permissions?organizationId=${member.organizationId}`)
        .set(member.headers)

    const before = await permissions()
    expect(before.status).toBe(200)
    expect(before.body).toMatchObject({ role: 'ADMIN', canApprove: true })
    expect(before.body.permissions).toContain('requests:approve')

    await prisma.membership.update({
      where: {
        userId_organizationId: { userId: member.id, organizationId: member.organizationId },
      },
      data: { role: 'VOLUNTEER' },
    })

    const after = await permissions()
    expect(after.status).toBe(200)
    expect(after.body).toMatchObject({ role: 'VOLUNTEER', canApprove: false })
    expect(after.body.permissions).not.toContain('requests:approve')
  })

  it('[RBAC-05] ADMIN da organização A não altera membros, pets nem convites da B', async () => {
    const adminA = await makeGuardian('rbac05-admin-a')
    const organizationB = await ensureTestOrganization('Organização RBAC-05 B', 'RB')
    const adminB = await makeGuardian('rbac05-admin-b', 'ADMIN', organizationB.id)
    await makePet('rbac05-pet-b', organizationB.id)

    const invite = await request(app)
      .post(`/api/organizations/${organizationB.id}/invitations`)
      .set(adminA.headers)
      .send({ email: 'convidado-rbac05@exemplo.com', role: 'VOLUNTEER' })
    const changeRole = await request(app)
      .patch(`/api/organizations/${organizationB.id}/members/${adminB.id}`)
      .set(adminA.headers)
      .send({ role: 'VOLUNTEER' })
    const updatePet = await request(app)
      .put('/api/me/organization-pets/rbac05-pet-b')
      .set(adminA.headers)
      .send(petPayload('Pet da organização B'))
    const updateOrganization = await request(app)
      .put(`/api/organizations/${organizationB.id}`)
      .set(adminA.headers)
      .send({ name: 'Organização invadida' })

    for (const response of [invite, changeRole, updatePet, updateOrganization]) {
      expect(response.status).toBe(403)
    }
    expect(await prisma.invitation.count({ where: { organizationId: organizationB.id } })).toBe(0)
  })

  it('[RBAC-06] MODERADOR da plataforma não ganha permissões de organização', async () => {
    const organization = await ensureTestOrganization('Organização RBAC-06', 'RB')
    const moderator = await makeUser('rbac06-moderator', {
      guardian: true,
      platformRole: 'MODERADOR',
    })
    const platformAbility = createAbility({ role: 'MODERADOR' })
    expect(platformAbility.can('manage', 'Report')).toBe(true)
    expect(platformAbility.can('read', 'Pet')).toBe(false)
    expect(platformAbility.can('manage', 'Organization')).toBe(false)

    const permissions = await request(app).get('/api/me/permissions').set(moderator.headers)
    const readOrganization = await request(app)
      .get(`/api/organizations/${organization.id}`)
      .set(moderator.headers)

    expect(permissions.status).toBe(403)
    expect(readOrganization.status).toBe(403)
  })

  it('[RBAC-07] listagens usam accessibleBy e não mostram outra organização', async () => {
    const member = await makeGuardian('rbac07-member-a')
    const organizationB = await ensureTestOrganization('Organização RBAC-07 B', 'RB')
    const adopter = await makeAdopter('rbac07-adopter')
    await makePet('rbac07-pet-a', member.organizationId)
    await makePet('rbac07-pet-b', organizationB.id)
    await makeRequest('rbac07-request-a', 'rbac07-pet-a', adopter.id, 'Enviada')
    await makeRequest('rbac07-request-b', 'rbac07-pet-b', adopter.id, 'Enviada')

    const pets = await request(app)
      .get(`/api/me/organization-pets?organizationId=${member.organizationId}`)
      .set(member.headers)
    const requests = await request(app)
      .get(`/api/me/received-requests?organizationId=${member.organizationId}`)
      .set(member.headers)

    expect(pets.status).toBe(200)
    expect(pets.body.data.map((pet: { id: string }) => pet.id)).toEqual(['rbac07-pet-a'])
    expect(requests.status).toBe(200)
    expect(requests.body.data.map((item: { id: string }) => item.id)).toEqual(['rbac07-request-a'])
  })

  it('[RBAC-08] rota privada sem regra declarada é negada por padrão', async () => {
    const user = await makeUser('rbac08-user')

    const response = await request(app).get('/api/me/sem-regra-declarada-rbac08').set(user.headers)

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ statusCode: 403, error: 'Forbidden' })
  })
})
