// Semeia o banco com os dados de referência do mock (mock-server/db.seed.json).
// O mock continua sendo a fonte de verdade do contrato; aqui só levamos os dados pro Postgres.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hash } from '@node-rs/argon2'
import { requestStatusCodeOf } from '@adotapet/shared'
import { prisma } from '../src/db.js'

/** Senha única das contas de demonstração (documentada no README da API). */
const DEMO_PASSWORD = 'Senha@123'

interface SeedData {
  users: Array<{
    id: string
    name: string
    email: string
    role: string
    roles: string[]
    lat?: number
    lng?: number
  }>
  pets: Array<Record<string, unknown> & { id: string }>
  profile: Record<string, unknown>
  guardianProfile: Record<string, unknown>
  favorites: Array<{ id: number; userId: string; petId: string; createdAt: string }>
  requests: Array<{
    id: string
    petId: string
    status: string
    date: string
    message: string
    userId: string
    answers?: unknown
    interview?: unknown
    rejectionReason?: string | null
  }>
  chatMessages: Array<{
    id: string
    requestId: string
    authorId: string
    body: string
    createdAt: string
    readAt: string | null
  }>
  notifications: Array<{
    id: string
    userId: string
    type: string
    title: string
    body: string
    link: string
    readAt: string | null
    createdAt: string
  }>
  notificationPreferences: Array<{
    userId: string
    type: string
    inApp: boolean
    email: boolean
  }>
  savedFilters: Array<{
    id: string
    userId: string
    name: string
    criteria: unknown
    active: boolean
    createdAt: string
  }>
}

const here = path.dirname(fileURLToPath(import.meta.url))
const seedPath = path.resolve(here, '../../web/mock-server/db.seed.json')
const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedData

async function main() {
  const demoPasswordHash = await hash(DEMO_PASSWORD)

  // Reset em ordem de dependência (FKs) dentro de uma transação: seed idempotente.
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.report.deleteMany(),
    prisma.review.deleteMany(),
    prisma.savedFilter.deleteMany(),
    prisma.checkIn.deleteMany(),
    prisma.followUpPlan.deleteMany(),
    prisma.adoption.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.adoptionRequest.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.pet.deleteMany(),
    prisma.adopterProfile.deleteMany(),
    prisma.guardianProfile.deleteMany(),
    prisma.user.deleteMany(),
  ])

  await prisma.user.createMany({
    data: seed.users.map(({ id, name, email, role, roles, lat, lng }) => ({
      id,
      name,
      // `demo-empty` veio do mock com e-mail vazio; o e-mail agora é único no banco.
      email: email || `${id}@adotapet.local`,
      role,
      roles,
      lat: lat ?? null,
      lng: lng ?? null,
      passwordHash: demoPasswordHash,
    })),
  })

  // Terceira conta pedida pela issue #48: moderador para o fluxo de denúncias (#26).
  await prisma.user.create({
    data: {
      id: 'demo-moderator',
      name: 'Moderador AdotaPet',
      email: 'moderador@adotapet.local',
      role: 'MODERADOR',
      roles: ['MODERADOR'],
      passwordHash: demoPasswordHash,
      platformRole: 'MODERADOR',
    },
  })

  await prisma.pet.createMany({
    data: seed.pets.map((pet) => ({
      ...pet,
      gallery: (pet.gallery as string[] | undefined) ?? [],
      lat: (pet.lat as number | null) ?? null,
      lng: (pet.lng as number | null) ?? null,
      createdAt: new Date(pet.createdAt as string),
    })),
  })

  const organizations = new Map<string, string>()
  for (const pet of seed.pets) {
    const name = String(pet.organization ?? '').trim()
    if (!name || organizations.has(name)) continue
    organizations.set(name, String(pet.organizationInitials ?? '').trim())
  }
  await prisma.organization.createMany({
    data: [...organizations].map(([name, initials]) => ({
      name,
      initials: initials || name.slice(0, 2).toUpperCase(),
    })),
    skipDuplicates: true,
  })

  const { userId: adopterUserId, ...adopterFields } = seed.profile
  await prisma.adopterProfile.create({
    data: { ...adopterFields, userId: adopterUserId as string },
  })

  const { userId: guardianUserId, ...guardianFields } = seed.guardianProfile
  await prisma.guardianProfile.create({
    data: { ...guardianFields, userId: guardianUserId as string },
  })
  const organizationName = String(guardianFields.displayName ?? guardianFields.legalName ?? '')
  const organization = await prisma.organization.upsert({
    where: { name: organizationName },
    update: {},
    create: {
      name: organizationName,
      initials: organizationName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join(''),
      description: String(guardianFields.description ?? ''),
      city: String(guardianFields.city ?? ''),
      contactEmail: String(guardianFields.email ?? ''),
      phone: String(guardianFields.phone ?? ''),
    },
  })
  await prisma.membership.create({
    data: {
      userId: guardianUserId as string,
      organizationId: organization.id,
      role: 'ADMIN',
      status: 'ATIVO',
    },
  })

  await prisma.favorite.createMany({
    data: seed.favorites.map(({ userId, petId, createdAt }) => ({
      userId,
      petId,
      createdAt: new Date(createdAt),
    })),
  })

  await prisma.adoptionRequest.createMany({
    data: seed.requests.map(
      ({ id, petId, status, date, message, userId, answers, interview, rejectionReason }) => ({
        id,
        petId,
        status: requestStatusCodeOf(status) ?? status,
        date: new Date(date),
        message,
        userId,
        answers: answers ?? undefined,
        interview: interview ?? undefined,
        rejectionReason: rejectionReason ?? null,
      }),
    ),
  })

  for (const adoptionRequest of seed.requests.filter(
    ({ status }) => status.toUpperCase() === 'APROVADA',
  )) {
    const pet = await prisma.pet.findUniqueOrThrow({
      where: { id: adoptionRequest.petId },
    })
    const organization = await prisma.organization.findUnique({
      where: { name: pet.organization },
    })
    if (!organization) {
      throw new Error(`Organização não encontrada para o pet ${pet.id}`)
    }

    await prisma.adoption.create({
      data: {
        requestId: adoptionRequest.id,
        petId: pet.id,
        adopterId: adoptionRequest.userId,
        organizationId: organization.id,
        adoptedAt: new Date(adoptionRequest.date),
      },
    })
    await prisma.pet.update({
      where: { id: pet.id },
      data: { status: 'ADOTADO' },
    })
  }

  await prisma.chatMessage.createMany({
    data: seed.chatMessages.map(({ id, requestId, authorId, body, createdAt, readAt }) => ({
      id,
      requestId,
      authorId,
      body,
      createdAt: new Date(createdAt),
      readAt: readAt ? new Date(readAt) : null,
    })),
  })

  await prisma.notification.createMany({
    data: seed.notifications.map(({ id, userId, type, title, body, link, readAt, createdAt }) => ({
      id,
      userId,
      type,
      title,
      body,
      link,
      readAt: readAt ? new Date(readAt) : null,
      createdAt: new Date(createdAt),
    })),
  })

  if (seed.notificationPreferences.length > 0) {
    await prisma.notificationPreference.createMany({ data: seed.notificationPreferences })
  }

  if (seed.savedFilters.length > 0) {
    await prisma.savedFilter.createMany({
      data: seed.savedFilters.map(({ id, userId, name, criteria, active, createdAt }) => ({
        id,
        userId,
        name,
        criteria: criteria as object,
        active,
        createdAt: new Date(createdAt),
      })),
    })
  }

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.pet.count(),
    prisma.adoptionRequest.count(),
    prisma.notification.count(),
  ])
  console.log(
    `Seed concluído: ${counts[0]} usuários, ${counts[1]} pets, ${counts[2]} solicitações, ${counts[3]} notificações.`,
  )
  console.log(
    `Contas de demonstração (senha ${DEMO_PASSWORD}): demo@adotapet.local (adotante), ` +
      'contato@institutopatinhas.org (ONG) e moderador@adotapet.local (moderador).',
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
