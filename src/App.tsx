import { lazy, type ReactNode, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { useAdopterProfile } from './hooks/useAdopterProfile'
import { useGuardianProfile } from './hooks/useGuardianProfile'
import { useDemoAccount } from './hooks/useDemoAccount'

const named = <T extends string>(load: () => Promise<Record<T, React.ComponentType>>, name: T) =>
  lazy(() => load().then((module) => ({ default: module[name] })))

const HomePage = named(() => import('./pages/HomePage'), 'HomePage')
const PetsPage = named(() => import('./pages/PetsPage'), 'PetsPage')
const PetDetailPage = named(() => import('./pages/PetDetailPage'), 'PetDetailPage')
const FavoritesPage = named(() => import('./pages/FavoritesPage'), 'FavoritesPage')
const SavedSearchesPage = named(
  () => import('./pages/SavedSearchesPage'),
  'SavedSearchesPage',
)
const CompatibilityPage = named(() => import('./pages/CompatibilityPage'), 'CompatibilityPage')
const QuestionnairePage = named(() => import('./pages/QuestionnairePage'), 'QuestionnairePage')
const RequestsPage = named(() => import('./pages/RequestsPage'), 'RequestsPage')
const RequestSuccessPage = named(() => import('./pages/RequestSuccessPage'), 'RequestSuccessPage')
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage')
const CreateAccountPage = named(() => import('./pages/CreateAccountPage'), 'CreateAccountPage')
const OrganizationDashboardPage = named(
  () => import('./pages/OrganizationDashboardPage'),
  'OrganizationDashboardPage',
)
const OrganizationPetsPage = named(
  () => import('./pages/OrganizationPetsPage'),
  'OrganizationPetsPage',
)
const OrganizationPetFormPage = named(
  () => import('./pages/OrganizationPetFormPage'),
  'OrganizationPetFormPage',
)
const OrganizationRequestsPage = named(
  () => import('./pages/OrganizationRequestsPage'),
  'OrganizationRequestsPage',
)
const NotFoundPage = named(() => import('./pages/NotFoundPage'), 'NotFoundPage')

function ProtectedRoute({ children }: { children: ReactNode }) {
  const account = useDemoAccount()
  const location = useLocation()
  if (!account.isAuthenticated) {
    return <Navigate to="/criar-conta" replace state={{ from: location.pathname }} />
  }
  return children
}

function AccountTypeRoute({
  type,
  children,
}: {
  type: 'adopter' | 'guardian'
  children: ReactNode
}) {
  const account = useDemoAccount()
  const location = useLocation()
  if (!account.isAuthenticated)
    return <Navigate to="/criar-conta" replace state={{ from: location.pathname }} />
  const isGuardian = account.profilePath === '/perfil?tipo=responsavel'
  if ((type === 'guardian') !== isGuardian)
    return <Navigate to={isGuardian ? '/organizacao' : '/'} replace />
  return children
}

export default function App() {
  const account = useDemoAccount()
  const profileQuery = useAdopterProfile()
  const guardianProfileQuery = useGuardianProfile()
  const { pathname } = useLocation()
  const isGuardianAccount = account.profilePath === '/perfil?tipo=responsavel'
  const profileName = isGuardianAccount
    ? guardianProfileQuery.data?.profile.displayName ||
      guardianProfileQuery.data?.profile.legalName ||
      ''
    : (profileQuery.data?.profile.name ?? '')

  return (
    <Layout
      profileName={account.isAuthenticated ? profileName : ''}
      profilePath={account.isAuthenticated ? account.profilePath : '/criar-conta'}
    >
      <ErrorBoundary resetKeys={[pathname]}>
        <Suspense fallback={<div className="app-feedback">Carregando...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pets" element={<PetsPage />} />
            <Route path="/pets/:petId" element={<PetDetailPage />} />
            <Route
              path="/favoritos"
              element={
                <AccountTypeRoute type="adopter">
                  <FavoritesPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/minhas-buscas"
              element={<SavedSearchesPage />}
            />
            <Route
              path="/pets/:petId/compatibilidade"
              element={
                <AccountTypeRoute type="adopter">
                  <CompatibilityPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/pets/:petId/questionario"
              element={
                <AccountTypeRoute type="adopter">
                  <QuestionnairePage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/solicitacoes"
              element={
                <AccountTypeRoute type="adopter">
                  <RequestsPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/solicitacoes/:requestId/enviada"
              element={
                <AccountTypeRoute type="adopter">
                  <RequestSuccessPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizacao"
              element={
                <AccountTypeRoute type="guardian">
                  <OrganizationDashboardPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/organizacao/pets"
              element={
                <AccountTypeRoute type="guardian">
                  <OrganizationPetsPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/organizacao/pets/novo"
              element={
                <AccountTypeRoute type="guardian">
                  <OrganizationPetFormPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/organizacao/pets/:petId/editar"
              element={
                <AccountTypeRoute type="guardian">
                  <OrganizationPetFormPage />
                </AccountTypeRoute>
              }
            />
            <Route
              path="/organizacao/solicitacoes"
              element={
                <AccountTypeRoute type="guardian">
                  <OrganizationRequestsPage />
                </AccountTypeRoute>
              }
            />
            <Route path="/criar-conta" element={<CreateAccountPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}
