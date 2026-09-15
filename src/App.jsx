import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { initialProfile, initialRequests, pets } from './data/pets'
import { CompatibilityPage } from './pages/CompatibilityPage'
import { HomePage } from './pages/HomePage'
import { PetDetailPage } from './pages/PetDetailPage'
import { PetsPage } from './pages/PetsPage'
import { ProfilePage } from './pages/ProfilePage'
import { QuestionnairePage } from './pages/QuestionnairePage'
import { RequestsPage } from './pages/RequestsPage'
import { RequestSuccessPage } from './pages/RequestSuccessPage'

export default function App() {
  const [profile, setProfile] = useState(initialProfile)
  const [favorites, setFavorites] = useState(['luna'])
  const [requests, setRequests] = useState(initialRequests)

  const toggleFavorite = (petId) => setFavorites((current) => current.includes(petId) ? current.filter((id) => id !== petId) : [...current, petId])

  const createRequest = (pet, answers) => {
    const id = `SOL-${String(1042 + requests.length).padStart(4, '0')}`
    const request = { id, petId: pet.id, status: 'Enviada', date: '14 set 2026', message: 'Sua solicitação foi enviada e aguarda o início da análise.', answers }
    setRequests((current) => [request, ...current])
    return request
  }

  const cancelRequest = (requestId) => setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: 'Cancelada', message: 'Você cancelou esta solicitação.' } : request))

  return (
    <Layout requestCount={requests.filter((request) => !['Cancelada', 'Recusada'].includes(request.status)).length}>
      <Routes>
        <Route path="/" element={<HomePage pets={pets} favorites={favorites} onFavorite={toggleFavorite} />} />
        <Route path="/pets" element={<PetsPage pets={pets} favorites={favorites} onFavorite={toggleFavorite} />} />
        <Route path="/pets/:petId" element={<PetDetailPage pets={pets} favorites={favorites} onFavorite={toggleFavorite} />} />
        <Route path="/pets/:petId/compatibilidade" element={<CompatibilityPage pets={pets} profile={profile} />} />
        <Route path="/pets/:petId/questionario" element={<QuestionnairePage pets={pets} onSubmit={createRequest} />} />
        <Route path="/solicitacoes" element={<RequestsPage requests={requests} pets={pets} onCancel={cancelRequest} />} />
        <Route path="/solicitacoes/:requestId/enviada" element={<RequestSuccessPage requests={requests} pets={pets} />} />
        <Route path="/perfil" element={<ProfilePage profile={profile} onSave={setProfile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
