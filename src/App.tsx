import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { initialProfile } from './data/pets'
import {
  useAdoptionRequests,
  useCancelAdoptionRequest,
  useCreateAdoptionRequest,
} from './hooks/useAdoptionRequests'
import { usePets } from './hooks/usePets'
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
  const [profile, setProfile] = useState(initialProfile)
  const [favorites, setFavorites] = useState<string[]>(['luna'])
  const petsQuery = usePets()
  const requestsQuery = useAdoptionRequests()
  const createRequestMutation = useCreateAdoptionRequest()
  const cancelRequestMutation = useCancelAdoptionRequest()

  const pets = petsQuery.data ?? []
  const requests = requestsQuery.data ?? []

  const toggleFavorite = (petId: string) =>
    setFavorites((current) =>
      current.includes(petId) ? current.filter((id) => id !== petId) : [...current, petId],
    )

  const createRequest = (pet: Pet, answers: QuestionnaireAnswers) =>
    createRequestMutation.mutateAsync({ pet, answers })

  const cancelRequest = (requestId: string) => cancelRequestMutation.mutateAsync(requestId)

  if (petsQuery.isPending || requestsQuery.isPending) {
    return <div className="app-feedback">Carregando dados...</div>
  }

  if (petsQuery.isError || requestsQuery.isError) {
    return (
      <div className="app-feedback error" role="alert">
        Não foi possível carregar os dados. Tente novamente.
      </div>
    )
  }

  return (
    <Layout
      profileName={profile.name}
      requestCount={
        requests.filter((request) => !['Cancelada', 'Recusada'].includes(request.status)).length
      }
    >
      <Routes>
        <Route
          path="/"
          element={<HomePage pets={pets} favorites={favorites} onFavorite={toggleFavorite} />}
        />
        <Route
          path="/pets"
          element={<PetsPage pets={pets} favorites={favorites} onFavorite={toggleFavorite} />}
        />
        <Route
          path="/pets/:petId"
          element={<PetDetailPage pets={pets} favorites={favorites} onFavorite={toggleFavorite} />}
        />
        <Route
          path="/pets/:petId/compatibilidade"
          element={<CompatibilityPage pets={pets} profile={profile} />}
        />
        <Route
          path="/pets/:petId/questionario"
          element={<QuestionnairePage pets={pets} onSubmit={createRequest} />}
        />
        <Route
          path="/solicitacoes"
          element={<RequestsPage requests={requests} pets={pets} onCancel={cancelRequest} />}
        />
        <Route
          path="/solicitacoes/:requestId/enviada"
          element={<RequestSuccessPage requests={requests} pets={pets} />}
        />
        <Route
          path="/perfil"
          element={
            <ProfilePage profile={profile} onSave={(savedProfile) => setProfile(savedProfile)} />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
