import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { useAdopterProfile } from './hooks/useAdopterProfile'

const named = <T extends string>(load: () => Promise<Record<T, React.ComponentType>>, name: T) =>
  lazy(() => load().then((module) => ({ default: module[name] })))

const HomePage = named(() => import('./pages/HomePage'), 'HomePage')
const PetsPage = named(() => import('./pages/PetsPage'), 'PetsPage')
const PetDetailPage = named(() => import('./pages/PetDetailPage'), 'PetDetailPage')
const FavoritesPage = named(() => import('./pages/FavoritesPage'), 'FavoritesPage')
const CompatibilityPage = named(() => import('./pages/CompatibilityPage'), 'CompatibilityPage')
const QuestionnairePage = named(() => import('./pages/QuestionnairePage'), 'QuestionnairePage')
const RequestsPage = named(() => import('./pages/RequestsPage'), 'RequestsPage')
const RequestSuccessPage = named(() => import('./pages/RequestSuccessPage'), 'RequestSuccessPage')
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage')
const NotFoundPage = named(() => import('./pages/NotFoundPage'), 'NotFoundPage')

export default function App() {
  const profileQuery = useAdopterProfile()
  const { pathname } = useLocation()

  return (
    <Layout profileName={profileQuery.data?.profile.name ?? ''}>
      <ErrorBoundary resetKeys={[pathname]}>
        <Suspense fallback={<div className="app-feedback">Carregando...</div>}>
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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}
