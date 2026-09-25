export interface Pet {
  id: string
  name: string
  species: string
  breed: string
  age: number
  ageLabel: string
  size: string
  sex: string
  city: string
  distance: string
  image: string
  gallery?: string[]
  summary: string
  description: string
  traits: string[]
  energy: string
  space: string
  children: boolean
  otherPets: boolean
  specialCare: boolean
  vaccinated: boolean
  neutered: boolean
  organization: string
  organizationInitials: string
}

export interface Profile {
  name: string
  initials: string
  housing: string
  hasOutdoorArea: boolean
  dailyTime: string
  activityLevel: string
  hasChildren: boolean
  hasOtherPets: boolean
  experience: string
  acceptsSpecialCare: boolean
  preferredSpecies: string
  preferredSize: string
}

export type RequestStatus = 'Em análise' | 'Aprovada' | 'Enviada' | 'Recusada' | 'Cancelada'

export interface QuestionnaireAnswers {
  motivation: string
  routine: string
  aloneTime: string
  adaptation: string
  costs: boolean
  commitment: boolean
}

export interface AdoptionRequest {
  id: string
  petId: string
  status: RequestStatus
  date: string
  message: string
  answers?: QuestionnaireAnswers
}
