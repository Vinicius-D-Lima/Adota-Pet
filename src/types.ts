import type { QuestionnaireAnswers } from './schemas/questionnaireSchema'

export type RequestStatus = 'Em análise' | 'Aprovada' | 'Enviada' | 'Recusada' | 'Cancelada'

export type { Pet } from './schemas/petSchema'
export type { Profile, ProfileDraft } from './schemas/profileSchema'
export type { QuestionnaireAnswers } from './schemas/questionnaireSchema'

export interface AdoptionRequest {
  id: string
  petId: string
  status: RequestStatus
  date: string
  message: string
  answers?: QuestionnaireAnswers
}
