import { lazy, type ReactNode, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { OrganizacaoGuard } from './components/OrganizacaoGuard'
import { Feedback } from './components/ui'
import { useAdopterProfile } from './hooks/useAdopterProfile'
import { useGuardianProfile } from './hooks/useGuardianProfile'
import { useDemoAccount } from './hooks/useDemoAccount'

const named = <T extends string>(load: () => Promise<Record<T, React.ComponentType>>, name: T) =>
  lazy(() => load().then((module) => ({ default: module[name] })))

const HomePage = named(() => import('./pages/HomePage'), 'HomePage')
const PetsPage = named(() => import('./pages/PetsPage'), 'PetsPage')
const PetDetailPage = named(() => import('./pages/PetDetailPage'), 'PetDetailPage')
const FavoritesPage = named(() => import('./pages/FavoritesPage'), 'FavoritesPage')
const SavedSearchesPage = named(() => import('./pages/SavedSearchesPage'), 'SavedSearchesPage')
const CompatibilityPage = named(() => import('./pages/CompatibilityPage'), 'CompatibilityPage')
const QuestionnairePage = named(() => import('./pages/QuestionnairePage'), 'QuestionnairePage')
const RequestsPage = named(() => import('./pages/RequestsPage'), 'RequestsPage')
const RequestSuccessPage = named(() => import('./pages/RequestSuccessPage'), 'RequestSuccessPage')
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage')
const CreateAccountPage = named(() => import('./pages/CreateAccountPage'), 'CreateAccountPage')
const LoginPage = named(() => import('./pages/LoginPage'), 'LoginPage')
const NotificationsPage = named(() => import('./pages/NotificationsPage'), 'NotificationsPage')
const NotificationPreferencesPage = named(
  () => import('./pages/NotificationPreferencesPage'),
  'NotificationPreferencesPage',
)
const ReportPage = named(() => import('./pages/ReportPage'), 'ReportPage')
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
const OrganizationRequestDetailPage = named(
  () => import('./pages/OrganizationRequestDetailPage'),
  'OrganizationRequestDetailPage',
)
const NotFoundPage = named(() => import('./pages/NotFoundPage'), 'NotFoundPage')

/** Não redireciona enquanto o refresh inicial está em voo (#4/#5: sem "piscar"). */
function SessionPending() {
  return <Feedback>Verificando sua sessão...</Feedback>
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const account = useDemoAccount()
  const location = useLocation()
  if (account.status === 'loading') return <SessionPending />
  if (!account.isAuthenticated) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }
  return children
}

/** Usuário autenticado não precisa ver login/cadastro (#5). */
function GuestRoute({ children }: { children: ReactNode }) {
  const account = useDemoAccount()
  if (account.status === 'loading') return <SessionPending />
  if (account.isAuthenticated) return <Navigate to="/" replace />
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
  if (account.status === 'loading') return <SessionPending />
  if (!account.isAuthenticated)
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  const isGuardian = account.profilePath === '/perfil?tipo=responsavel'
  if ((type === 'guardian') !== isGuardian)
    return <Navigate to={isGuardian ? '/organizacao' : '/'} replace />
  return children
}

function OrganizationArea() {
  return (
    <OrganizacaoGuard>
      <Outlet />
    </OrganizacaoGuard>
  )
}

export default function App() {
  const account = useDemoAccount()
  const profileQuery = useAdopterProfile(account.status !== 'loading')
  const guardianProfileQuery = useGuardianProfile(account.status !== 'loading')
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
      profilePath={account.isAuthenticated ? account.profilePath : '/cadastro'}
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
              element={
                <AccountTypeRoute type="adopter">
                  <SavedSearchesPage />
                </AccountTypeRoute>
              }
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
              path="/notificacoes"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notificacoes/preferencias"
              element={
                <ProtectedRoute>
                  <NotificationPreferencesPage />
                </ProtectedRoute>
              }
            />
            <Route element={<OrganizationArea />}>
              <Route path="/organizacao" element={<OrganizationDashboardPage />} />
              <Route path="/organizacao/pets" element={<OrganizationPetsPage />} />
              <Route path="/organizacao/pets/novo" element={<OrganizationPetFormPage />} />
              <Route path="/organizacao/pets/:petId/editar" element={<OrganizationPetFormPage />} />
              <Route path="/organizacao/solicitacoes" element={<OrganizationRequestsPage />} />
              <Route
                path="/organizacao/solicitacoes/:requestId"
                element={<OrganizationRequestDetailPage />}
              />
            </Route>
            <Route
              path="/cadastro"
              element={
                <GuestRoute>
                  <CreateAccountPage />
                </GuestRoute>
              }
            />
            <Route
              path="/criar-conta"
              element={
                <GuestRoute>
                  <CreateAccountPage />
                </GuestRoute>
              }
            />
            <Route
              path="/entrar"
              element={
                <GuestRoute>
                  <LoginPage />
                </GuestRoute>
              }
            />
            <Route
              path="/denuncias/nova"
              element={
                <ProtectedRoute>
                  <ReportPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}
