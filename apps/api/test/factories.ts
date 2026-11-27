import type { OrganizationRole } from '@adotapet/shared'
import { signAccessToken } from '../src/auth.js'
import { prisma } from '../src/db.js'
import { ensureTestOrganization } from './organization.js'

export type Headers = Record<string, string>

export const bearer = (token: string): Headers => ({ Authorization: `Bearer ${token}` })

export const ORGANIZATION = 'Instituição Patinhas'

export const PROFILE = {
  name: 'Ana Souza',
  cpf: '529.982.247-25',
  birthDate: '1990-05-10',
  email: 'ana@exemplo.com',
  phone: '(11) 98888-7777',
  zipCode: '01310-100',
  address: 'Avenida Paulista, 1000',
  housing: 'Apartamento',
  hasOutdoorArea: false,
  dailyTime: '2 a 3 horas',
  activityLevel: 'Moderado',
  hasChildren: false,
  hasOtherPets: false,
  experience: 'Já tive pets',
  acceptsSpecialCare: true,
  preferredSpecies: 'Cachorro',
  preferredSize: 'Médio ou grande',
} as const

export const QUESTIONNAIRE = {
  motivation: 'Quero dar um lar cheio de carinho para um pet que precisa de uma segunda chance.',
  routine: 'Trabalho em casa pela manhã e caminho com o pet todas as tardes no parque do bairro.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço calmo e apresentar a rotina da casa aos poucos.',
  costs: true,
  commitment: true,
} as const

interface UserOptions {
  guardian?: boolean
  completeProfile?: boolean
  organizationName?: string
  organizationRole?: OrganizationRole
  platformRole?: 'USUARIO' | 'MODERADOR'
}

export async function makeUser(id: string, options: UserOptions = {}) {
  const guardian = options.guardian ?? false
  const organizationName = options.organizationName ?? ORGANIZATION
  const user = await prisma.user.create({
    data: {
      id,
      name: guardian ? 'Equipe Patinhas' : PROFILE.name,
      email: `${id}@exemplo.com`,
      role: guardian ? 'GUARDIAN' : 'ADOTANTE',
      roles: guardian ? ['GUARDIAN'] : [],
      organizationRole: options.organizationRole ?? 'ADMIN',
      platformRole: options.platformRole ?? 'USUARIO',
      organizationName: guardian ? organizationName : null,
    },
  })
  if (guardian) {
    await prisma.guardianProfile.create({
      data: {
        userId: id,
        guardianType: 'ORGANIZATION',
        displayName: organizationName,
        legalName: organizationName,
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
  } else if (options.completeProfile ?? true) {
    await prisma.adopterProfile.create({ data: { userId: id, ...PROFILE } })
  }
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

export async function addMembership(
  userId: string,
  organizationName = ORGANIZATION,
  role: OrganizationRole = 'ADMIN',
) {
  const organization = await ensureTestOrganization(organizationName, 'IP')
  return prisma.membership.create({
    data: { userId, organizationId: organization.id, role, status: 'ATIVO' },
  })
}

export async function makePet(
  id: string,
  options: { organization?: string; status?: string; name?: string; description?: string } = {},
) {
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
      createdAt: new Date(),
      status: options.status ?? 'DISPONIVEL',
    },
  })
}

export async function makeRequest(
  id: string,
  userId: string,
  petId: string,
  options: { status?: string; answers?: object } = {},
) {
  return prisma.adoptionRequest.create({
    data: {
      id,
      userId,
      petId,
      status: options.status ?? 'ANALISE_QUESTIONARIO',
      date: new Date(),
      message: 'Solicitação em análise',
      answers: options.answers ?? QUESTIONNAIRE,
      interview: { completed: true, status: 'REALIZADA' },
    },
  })
}

export async function makeAdoption(id: string, organizationName = ORGANIZATION) {
  const organization = await ensureTestOrganization(organizationName, 'IP')
  const adopter = await makeUser(`${id}-adopter`)
  const admin = await makeUser(`${id}-admin`, { guardian: true, organizationName })
  await addMembership(admin.user.id, organizationName)
  const pet = await makePet(`${id}-pet`, { organization: organizationName })
  const request = await makeRequest(`${id}-request`, adopter.user.id, pet.id)
  const adoption = await prisma.adoption.create({
    data: {
      requestId: request.id,
      petId: pet.id,
      adopterId: adopter.user.id,
      organizationId: organization.id,
    },
  })
  await prisma.pet.update({ where: { id: pet.id }, data: { status: 'ADOTADO' } })
  return { adoption, adopter, admin, pet, request, organization }
}
