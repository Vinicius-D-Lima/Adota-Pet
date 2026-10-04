import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAdopterProfile } from './hooks/useAdopterProfile'
import { CompatibilityPage } from './pages/CompatibilityPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { HomePage } from './pages/HomePage'
import { PetDetailPage } from './pages/PetDetailPage'
import { PetsPage } from './pages/PetsPage'
import { ProfilePage } from './pages/ProfilePage'
import { QuestionnairePage } from './pages/QuestionnairePage'
import { RequestsPage } from './pages/RequestsPage'
import { RequestSuccessPage } from './pages/RequestSuccessPage'

export default function App() {
  const profileQuery = useAdopterProfile()

  return (
    <Layout profileName={profileQuery.data?.profile.name ?? ''}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pets" element={<PetsPage />} />
        <Route path="/pets/:petId" element={<PetDetailPage />} />
        <Route path="/favoritos" element={<FavoritesPage />} />
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
