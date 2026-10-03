import type { AdoptionRequest, ProfileDraft } from '../types'

export const initialProfile: ProfileDraft = {
  name: '',
  cpf: '',
  birthDate: '',
  email: '',
  phone: '',
  zipCode: '',
  address: '',
  housing: '',
  hasOutdoorArea: '',
  dailyTime: '',
  activityLevel: '',
  hasChildren: '',
  hasOtherPets: '',
  experience: '',
  acceptsSpecialCare: '',
  preferredSpecies: '',
  preferredSize: '',
}

export const initialRequests: AdoptionRequest[] = [
  {
    id: 'SOL-1042',
    petId: 'mimi',
    status: 'Em análise',
    date: '08 set 2026',
    message: 'A organização recebeu sua solicitação e está revisando seu perfil.',
  },
]
