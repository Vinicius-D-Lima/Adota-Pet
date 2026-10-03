import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAdopterProfile } from './hooks/useAdopterProfile'
import { CompatibilityPage } from './pages/CompatibilityPage'
import { HomePage } from './pages/HomePage'
import { PetDetailPage } from './pages/PetDetailPage'
import { PetsPage } from './pages/PetsPage'
import { ProfilePage } from './pages/ProfilePage'
import { QuestionnairePage } from './pages/QuestionnairePage'
import { RequestsPage } from './pages/RequestsPage'
import { RequestSuccessPage } from './pages/RequestSuccessPage'

export default function App() {
  const [favorites, setFavorites] = useState<string[]>(['luna'])
  const profileQuery = useAdopterProfile()

  const toggleFavorite = (petId: string) =>
    setFavorites((current) =>
      current.includes(petId) ? current.filter((id) => id !== petId) : [...current, petId],
    )

  return (
    <Layout profileName={profileQuery.data?.profile.name ?? ''}>
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
        <Route path="/pets/:petId/questionario" element={<QuestionnairePage />} />
        <Route path="/solicitacoes" element={<RequestsPage />} />
        <Route path="/solicitacoes/:requestId/enviada" element={<RequestSuccessPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
