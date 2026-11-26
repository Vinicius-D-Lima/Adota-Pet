import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ClipboardList,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  PawPrint,
  ShieldAlert,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMyAdoptions } from '../hooks/useAdoptions'
import { useAdoptionRequests } from '../hooks/useAdoptionRequests'
import { useDemoAccount } from '../hooks/useDemoAccount'
import { useFavoriteIds } from '../hooks/useFavorites'
import {
  useOrganizations,
  useSelectedOrganizationId,
  useSwitchOrganization,
} from '../hooks/useOrganizations'
import { useReceivedRequests } from '../hooks/useOrganization'
import { usePermissions, type OrganizationMembership } from '../lib/permissions'
import { getInitials } from '../utils/getInitials'
import { isActiveRequest } from '../utils/requestStatus'
import { Can } from './Can'
import { FavoriteNotice } from './FavoriteNotice'
import { NotificationBell } from './NotificationBell'
import { Container, cx } from './ui'

interface LayoutProps {
  children: ReactNode
  profileName: string
  profilePath?: string
}

function Brand({ light = false, markSize = 21 }: { light?: boolean; markSize?: number }) {
  return (
    <Link
      to="/"
      className={cx(
        'inline-flex items-center gap-2.5 font-display text-[23px] font-bold tracking-[-0.04em]',
        light ? 'text-white' : 'text-forest-900',
      )}
      aria-label={light ? undefined : 'AdotaPet — início'}
    >
      <span className="grid size-[38px] -rotate-3 place-items-center rounded-[13px_13px_13px_4px] bg-coral text-white">
        <PawPrint size={markSize} strokeWidth={light ? 2 : 2.5} />
      </span>
      <span>
        Adota<span className="text-coral">Pet</span>
      </span>
    </Link>
  )
}

export function Layout({ children, profileName, profilePath = '/perfil' }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const account = useDemoAccount()
  // O acesso à área vem de /me/permissions, nunca do caminho do perfil (#41).
  const selectedOrganizationId = useSelectedOrganizationId()
  const permissions = usePermissions({
    enabled: account.isAuthenticated,
    organizationId: selectedOrganizationId,
  })
  const isMember = Boolean(permissions.data?.organization)
  const isGuardian = account.profilePath === '/perfil?tipo=responsavel'
  const organizationsQuery = useOrganizations({
    enabled: account.isAuthenticated && isMember,
    organizationId: selectedOrganizationId,
  })
  const switchOrganization = useSwitchOrganization()
  const organizations = useMemo(() => organizationsQuery.data ?? [], [organizationsQuery.data])
  const requestsQuery = useAdoptionRequests(account.status !== 'loading')
  const requestCount =
    requestsQuery.data?.filter((item) => isActiveRequest(item.status)).length ?? 0
  const adoptionsQuery = useMyAdoptions(account.isAuthenticated && !isGuardian)
  const hasAdoptions = (adoptionsQuery.data?.length ?? 0) > 0
  const [open, setOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const favoriteCount = useFavoriteIds(account.status !== 'loading').data?.length ?? 0
  const receivedRequestCount =
    useReceivedRequests(account.isAuthenticated && isMember).data?.data.filter((item) =>
      ['Enviada', 'Em análise'].includes(item.status),
    ).length ?? 0
  const savedName = profileName.trim()
  const initials = savedName ? getInitials(savedName) : ''
  const firstName = savedName.split(/\s+/)[0]
  const showOrganizationNav = isMember && location.pathname.startsWith('/organizacao')

  useEffect(() => {
    if (!organizations.length) return
    if (!organizations.some(({ id }) => id === selectedOrganizationId)) {
      switchOrganization(organizations[0].id)
    }
  }, [organizations, selectedOrganizationId, switchOrganization])

  const nav: [string, string][] =
    account.isAuthenticated && isMember
      ? [
          ['/organizacao', 'Painel'],
          ['/organizacao/pets', 'Meus pets'],
          ['/organizacao/solicitacoes', 'Solicitações recebidas'],
          [profilePath, 'Perfil da instituição'],
        ]
      : [
          ['/', 'Início'],
          ['/pets', 'Encontrar pets'],
          ...(account.isAuthenticated
            ? ([
                ['/favoritos', 'Favoritos'],
                ['/minhas-buscas', 'Buscas salvas'],
                ['/solicitacoes', 'Minhas solicitações'],
                ...(hasAdoptions ? ([['/adocoes', 'Minhas adoções']] as [string, string][]) : []),
                [profilePath, 'Meu perfil'],
              ] as [string, string][])
            : []),
        ]

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [])

  const logout = async () => {
    setAccountMenuOpen(false)
    setOpen(false)
    // No modo real isto chama POST /auth/logout e limpa a sessão em memória.
    await account.logout()
    queryClient.clear()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 h-[68px] border-b border-forest-800/10 bg-white/95 backdrop-blur-xl md:h-[76px]">
        <Container className="flex h-full items-center gap-[15px] md:gap-9">
          <Brand />

          <button
            className="ml-auto grid cursor-pointer border-0 bg-transparent text-forest-800 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menu"
          >
            {open ? <X /> : <Menu />}
          </button>

          <nav
            className={cx(
              'absolute inset-x-3.5 top-[61px] rounded-[14px] border border-line bg-white p-2.5 shadow-soft',
              'md:static md:ml-auto md:flex md:items-center md:gap-[30px] md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none',
              open ? 'grid' : 'hidden',
            )}
            aria-label="Navegação principal"
          >
            {nav.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'relative flex items-center rounded-[9px] px-3 py-[15px] text-sm font-semibold text-[#52625a] hover:text-forest-800',
                    'md:rounded-none md:px-0 md:pb-[25px] md:pt-7',
                    isActive &&
                      'bg-forest-50 text-forest-800 md:bg-transparent md:after:absolute md:after:inset-x-0 md:after:bottom-4 md:after:h-0.5 md:after:rounded-sm md:after:bg-coral md:after:content-[""]',
                  )
                }
              >
                {label}
                {to === '/favoritos' && favoriteCount > 0 && <NavCount value={favoriteCount} />}
                {to === '/solicitacoes' && requestCount > 0 && <NavCount value={requestCount} />}
                {to === '/organizacao/solicitacoes' && receivedRequestCount > 0 && (
                  <NavCount value={receivedRequestCount} />
                )}
              </NavLink>
            ))}
            {!account.isAuthenticated && (
              <div className="mt-2 grid gap-2 border-t border-line pt-3 md:hidden">
                <Link
                  className="rounded-[9px] px-3 py-2.5 text-center text-sm font-semibold text-forest-800 hover:bg-forest-50"
                  to="/entrar"
                  onClick={() => setOpen(false)}
                >
                  Entrar
                </Link>
                <Link
                  className="rounded-[9px] bg-coral px-4 py-3 text-center text-sm font-bold text-white shadow-[0_8px_18px_rgba(233,120,82,0.22)] hover:bg-coral-dark"
                  to="/cadastro"
                  onClick={() => setOpen(false)}
                >
                  Criar conta
                </Link>
              </div>
            )}
            {account.isAuthenticated && (
              <div className="grid border-t border-line pt-2 md:hidden">
                <Link
                  className="flex items-center gap-2 rounded-[9px] px-3 py-[15px] text-sm font-semibold text-[#52625a] hover:bg-forest-50 hover:text-forest-800"
                  to="/minhas-denuncias"
                  onClick={() => setOpen(false)}
                >
                  <ShieldAlert size={17} /> Minhas denúncias
                </Link>
                <button
                  className="flex border-0 bg-transparent px-3 py-[15px] text-left text-sm font-semibold text-[#52625a]"
                  type="button"
                  onClick={logout}
                >
                  Sair
                </button>
              </div>
            )}
          </nav>

          {account.isAuthenticated && <NotificationBell enabled />}

          {account.isAuthenticated ? (
            <div className="relative hidden md:block" ref={accountMenuRef}>
              <button
                className="flex items-center gap-2 border-0 bg-transparent text-forest-800"
                type="button"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                onClick={() => setAccountMenuOpen((value) => !value)}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest-100 text-xs font-bold">
                  {initials || <UserRound size={17} />}
                </span>
                <span className="whitespace-nowrap text-left text-xs font-semibold">
                  {savedName ? (
                    <>
                      <span>Olá,</span>
                      <br />
                      <span>bem-vindo {firstName}</span>
                    </>
                  ) : (
                    'Minha conta'
                  )}
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {accountMenuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+12px)] z-50 grid min-w-[210px] gap-1 rounded-xl border border-line bg-white p-2 shadow-soft"
                  role="menu"
                >
                  <Link
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"
                    to={profilePath}
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <UserRound size={17} />{' '}
                    {isGuardian ? 'Perfil da instituição' : 'Visualizar meu perfil'}
                  </Link>
                  <Link
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"
                    to="/minhas-denuncias"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <ShieldAlert size={17} /> Minhas denúncias
                  </Link>
                  <button
                    className="flex items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-[#a33f2d] hover:bg-coral-pale"
                    type="button"
                    role="menuitem"
                    onClick={logout}
                  >
                    <LogOut size={17} /> Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex md:items-center md:gap-6">
              <NavLink
                to="/entrar"
                className={({ isActive }) =>
                  cx(
                    'text-sm font-semibold transition hover:text-forest-800',
                    isActive ? 'text-coral' : 'text-[#52625a]',
                  )
                }
              >
                Entrar
              </NavLink>
              <Link
                className="rounded-xl bg-coral px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_rgba(210,95,59,0.22)] transition hover:bg-coral-dark"
                to="/cadastro"
              >
                Criar conta
              </Link>
            </div>
          )}
        </Container>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        {showOrganizationNav && (
          <OrganizationSidebar
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onSelect={switchOrganization}
            onNavigate={() => setOpen(false)}
          />
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <FavoriteNotice />
      <footer className="bg-[#17382c] py-[45px] text-[#cbd8d1]">
        <Container className="flex flex-col items-start gap-[30px] md:flex-row md:items-center md:justify-between">
          <div>
            <Brand light markSize={20} />
            <p className="mb-0 mt-3 text-[11px] text-[#9db1a7]">
              Adoção responsável começa com um bom encontro.
            </p>
          </div>
          <p className="mb-0 mt-3 flex items-center gap-1.5 text-[11px] text-[#9db1a7]">
            <Heart size={15} fill="currentColor" className="text-coral" /> Feito para aproximar
            famílias e pets.
          </p>
        </Container>
      </footer>
    </div>
  )
}

function NavCount({ value }: { value: number }) {
  return (
    <span className="ml-[5px] inline-grid size-[18px] place-items-center rounded-full bg-coral text-[10px] text-white">
      {value}
    </span>
  )
}

interface OrganizationSidebarProps {
  organizations: OrganizationMembership[]
  selectedOrganizationId: string
  onSelect: (organizationId: string) => void
  onNavigate: () => void
}

/** Menu lateral da área `/organizacao/*`, com seletor quando há mais de uma ONG. */
function OrganizationSidebar({
  organizations,
  selectedOrganizationId,
  onSelect,
  onNavigate,
}: OrganizationSidebarProps) {
  const current = organizations.find(({ id }) => id === selectedOrganizationId)
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-muted hover:bg-forest-50 hover:text-forest-800',
      isActive && 'bg-forest-100 text-forest-800',
    )

  return (
    <aside
      aria-label="Menu da organização"
      className="border-b border-line bg-white/70 px-3 py-3 lg:w-[224px] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-4 lg:py-7"
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1 lg:block">
        <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-coral">
          Área da organização
        </p>
        {organizations.length > 1 ? (
          <label className="mt-2 flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-muted">
            Organização ativa
            <select
              aria-label="Organização ativa"
              className="w-full min-w-0 rounded-[9px] border border-line bg-white px-2 py-1.5 text-xs font-bold text-forest-800"
              value={selectedOrganizationId}
              onChange={(event) => onSelect(event.target.value)}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="m-0 mt-1 truncate text-xs font-bold text-forest-800">
            {current?.name ?? organizations[0]?.name ?? ''}
          </p>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:gap-1.5 lg:overflow-visible lg:pb-0">
        <NavLink to="/organizacao" onClick={onNavigate} className={linkClass}>
          <LayoutDashboard size={16} /> Painel
        </NavLink>
        <NavLink to="/organizacao/solicitacoes" onClick={onNavigate} className={linkClass}>
          <ClipboardList size={16} /> Solicitações
        </NavLink>
        <NavLink to="/organizacao/pets" onClick={onNavigate} className={linkClass}>
          <PawPrint size={16} /> Pets
        </NavLink>
        <NavLink to="/organizacao/adocoes" onClick={onNavigate} className={linkClass}>
          <Heart size={16} /> Adoções
        </NavLink>
        <Can do="read" on="Member" organizationId={selectedOrganizationId}>
          <NavLink to="/organizacao/membros" onClick={onNavigate} className={linkClass}>
            <UsersRound size={16} /> Membros
          </NavLink>
          <NavLink to="/organizacao/convites" onClick={onNavigate} className={linkClass}>
            <UserRound size={16} /> Convites
          </NavLink>
        </Can>
        <Can do="update" on="Organization" organizationId={selectedOrganizationId}>
          <NavLink to="/organizacao/dados" onClick={onNavigate} className={linkClass}>
            <ShieldAlert size={16} /> Dados da ONG
          </NavLink>
        </Can>
      </nav>
    </aside>
  )
}
