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
}

export const volunteerPermissions: PermissionsResponse = {
  role: 'VOLUNTEER',
  canApprove: false,
  permissions: ['requests:view', 'requests:review', 'requests:reject'],
  organization: { id: 'demo-organization', name: 'Instituto Patinhas', initials: 'IP' },
}
