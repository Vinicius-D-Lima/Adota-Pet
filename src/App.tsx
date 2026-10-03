import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import {
  useAdoptionRequests,
  useCancelAdoptionRequest,
  useCreateAdoptionRequest,
} from './hooks/useAdoptionRequests'
import { useAdopterProfile } from './hooks/useAdopterProfile'
import { CompatibilityPage } from './pages/CompatibilityPage'
import { HomePage } from './pages/HomePage'
import { PetDetailPage } from './pages/PetDetailPage'
import { PetsPage } from './pages/PetsPage'
import { ProfilePage } from './pages/ProfilePage'
import { QuestionnairePage } from './pages/QuestionnairePage'
import { RequestsPage } from './pages/RequestsPage'
import { RequestSuccessPage } from './pages/RequestSuccessPage'
import type { Pet, QuestionnaireAnswers } from './types'

export default function App() {
  const [favorites, setFavorites] = useState<string[]>(['luna'])
  const profileQuery = useAdopterProfile()
  const requestsQuery = useAdoptionRequests()
  const createRequestMutation = useCreateAdoptionRequest()
  const cancelRequestMutation = useCancelAdoptionRequest()

  const requests = requestsQuery.data ?? []

  const toggleFavorite = (petId: string) =>
    setFavorites((current) =>
      current.includes(petId) ? current.filter((id) => id !== petId) : [...current, petId],
    )

  const createRequest = (pet: Pet, answers: QuestionnaireAnswers) =>
    createRequestMutation.mutateAsync({ pet, answers })

  const cancelRequest = (requestId: string) => cancelRequestMutation.mutateAsync(requestId)

  if (requestsQuery.isPending) {
    return <div className="app-feedback">Carregando dados...</div>
  }

  if (requestsQuery.isError) {
    return (
      <div className="app-feedback error" role="alert">
        Não foi possível carregar os dados. Tente novamente.
      </div>
    )
  }

  return (
    <Layout
      profileName={profileQuery.data?.profile.name ?? ''}
      requestCount={
        requests.filter((request) => !['Cancelada', 'Recusada'].includes(request.status)).length
      }
    >
      <Routes>
        <Route path="/" element={<HomePage favorites={favorites} onFavorite={toggleFavorite} />} />
        <Route
          path="/pets"
          element={<PetsPage favorites={favorites} onFavorite={toggleFavorite} />}
        />
        <Route
          path="/pets/:petId"
          element={<PetDetailPage favorites={favorites} onFavorite={toggleFavorite} />}
        />
        <Route path="/pets/:petId/compatibilidade" element={<CompatibilityPage />} />
        <Route
          path="/pets/:petId/questionario"
          element={<QuestionnairePage onSubmit={createRequest} />}
        />
        <Route
          path="/solicitacoes"
          element={<RequestsPage requests={requests} onCancel={cancelRequest} />}
        />
        <Route
          path="/solicitacoes/:requestId/enviada"
          element={<RequestSuccessPage requests={requests} />}
        />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
