import type { PermissionsResponse } from '../../lib/permissions'
import type { ReceivedRequest } from '../../types'
import { requestPet } from './requests'

export const makeReceivedRequest = (overrides: Partial<ReceivedRequest> = {}): ReceivedRequest => ({
  id: 'SOL-2000',
  petId: requestPet.id,
  status: 'Em análise',
  date: '2026-09-08T12:00:00.000Z',
  message: 'A organização está analisando sua solicitação.',
  pet: requestPet,
  interview: null,
  rejectionReason: null,
  unreadMessageCount: 0,
  answers: {
    motivation: 'Quero dar um lar cheio de carinho e companhia para o pet.',
    routine: 'Trabalho em casa e faço caminhadas todos os dias.',
    aloneTime: 'Até 4 horas',
    adaptation: 'Vou preparar um cantinho tranquilo e adaptar a rotina aos poucos.',
    costs: true,
    commitment: true,
  },
  adopter: {
    id: 'demo',
    name: 'Lucas Ferreira',
    email: 'demo@adotapet.local',
    phone: '11999999999',
    completion: 100,
    housing: 'Apartamento',
    dailyTime: '2 a 3 horas',
    activityLevel: 'Moderado',
    hasOutdoorArea: false,
    acceptsSpecialCare: true,
    experience: 'Já tive pets',
    hasChildren: false,
    hasOtherPets: true,
    zipCode: '01001000',
    address: 'Rua das Flores, 123',
    city: 'São Paulo, SP',
  },
  ...overrides,
})

export const scheduledInterview = {
  type: 'Entrevista online',
  proposedSlots: ['2026-12-10T15:00:00.000Z', '2026-12-11T15:00:00.000Z'],
  status: 'AGENDADA' as const,
  completed: false,
  scheduledAt: '2026-11-18T12:00:00.000Z',
}

export const completedInterview = {
  ...scheduledInterview,
  status: 'REALIZADA' as const,
  completed: true,
  completedAt: '2026-12-10T16:00:00.000Z',
}

export const adminPermissions: PermissionsResponse = {
  role: 'ADMIN',
  canApprove: true,
  permissions: ['requests:view', 'requests:review', 'requests:approve', 'requests:reject'],
  organization: { id: 'demo-organization', name: 'Instituto Patinhas', initials: 'IP' },
  organizations: [
    { id: 'demo-organization', name: 'Instituto Patinhas', initials: 'IP', role: 'ADMIN' },
    { id: 'lar-animal', name: 'Lar Animal', initials: 'LA', role: 'VOLUNTEER' },
  ],
  rules: [{ action: 'manage', subject: 'all' }],
}

export const volunteerPermissions: PermissionsResponse = {
  role: 'VOLUNTEER',
  canApprove: false,
  permissions: ['requests:view', 'requests:review', 'requests:reject'],
  organization: { id: 'demo-organization', name: 'Instituto Patinhas', initials: 'IP' },
  organizations: [
    { id: 'demo-organization', name: 'Instituto Patinhas', initials: 'IP', role: 'VOLUNTEER' },
  ],
  rules: [
    { action: ['read', 'review', 'reject'], subject: 'Request' },
    { action: 'read', subject: ['Pet', 'Organization', 'Adoption'] },
  ],
}

export const organizationMembers = [
  {
    id: 'membership-admin',
    userId: 'demo-organization',
    name: 'Instituto Patinhas',
    email: 'contato@institutopatinhas.org',
    role: 'ADMIN' as const,
    status: 'ATIVO' as const,
    joinedAt: '2026-01-10T12:00:00.000Z',
  },
  {
    id: 'membership-mariana',
    userId: 'mariana',
    name: 'Mariana Souza',
    email: 'mariana@adotapet.local',
    role: 'VOLUNTEER' as const,
    status: 'ATIVO' as const,
    joinedAt: '2026-04-18T12:00:00.000Z',
  },
]

export const organizationInvitations = [
  {
    id: 'convite-1',
    email: 'ana@adotapet.local',
    role: 'VOLUNTEER' as const,
    status: 'PENDENTE' as const,
    expiresAt: '2026-12-10T12:00:00.000Z',
    acceptUrl: '/api/invitations/token-com-mais-de-vinte-caracteres/accept',
  },
]

export const organizationDetails = {
  id: 'demo-organization',
  name: 'Instituto Patinhas',
  displayName: 'Instituto Patinhas',
  initials: 'IP',
  cnpj: '11222333000181',
  document: '11222333000181',
  phone: '11955554444',
  email: 'contato@institutopatinhas.org',
  contactEmail: 'contato@institutopatinhas.org',
  address: 'Avenida Paulista, 1000 - Bela Vista',
  city: 'São Paulo, SP',
  description: 'Organização dedicada ao resgate, cuidado e adoção responsável de cães e gatos.',
}
