import type { ReceivedRequest } from '../schemas/organizationSchema'
import type { ProfileDraft } from '../types'
import { calculateCompatibility } from './calculateCompatibility'

/**
 * O detalhe da solicitação traz o perfil do adotante em uma forma resumida.
 * O cálculo de compatibilidade trabalha com o mesmo formato do perfil salvo,
 * então completamos os campos que não são usados no cálculo.
 */
export function toAdopterProfileDraft(adopter: ReceivedRequest['adopter']): ProfileDraft {
  return {
    name: adopter.name,
    cpf: '',
    birthDate: '',
    email: adopter.email,
    phone: adopter.phone,
    zipCode: adopter.zipCode ?? '',
    address: adopter.address ?? '',
    housing: (adopter.housing ?? '') as ProfileDraft['housing'],
    hasOutdoorArea: adopter.hasOutdoorArea ?? '',
    dailyTime: (adopter.dailyTime || 'Não informado') as ProfileDraft['dailyTime'],
    activityLevel: (adopter.activityLevel || 'Moderado') as ProfileDraft['activityLevel'],
    hasChildren: adopter.hasChildren ?? '',
    hasOtherPets: adopter.hasOtherPets ?? '',
    experience: (adopter.experience ?? '') as ProfileDraft['experience'],
    acceptsSpecialCare: adopter.acceptsSpecialCare ?? '',
    preferredSpecies: (adopter.preferredSpecies ?? '') as ProfileDraft['preferredSpecies'],
    preferredSize: (adopter.preferredSize ?? '') as ProfileDraft['preferredSize'],
  }
}

export function calculateRequestCompatibility(request: ReceivedRequest) {
  if (!request.pet) return null
  return calculateCompatibility(request.pet, toAdopterProfileDraft(request.adopter))
}
