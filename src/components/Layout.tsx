import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Heart, LogOut, Menu, PawPrint, UserRound, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAdoptionRequests } from '../hooks/useAdoptionRequests'
import { useDemoAccount } from '../hooks/useDemoAccount'
import { useFavoriteIds } from '../hooks/useFavorites'
import { useReceivedRequests } from '../hooks/useOrganization'
import { getInitials } from '../utils/getInitials'
import { isActiveRequest } from '../utils/requestStatus'
import { FavoriteNotice } from './FavoriteNotice'
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
  const queryClient = useQueryClient()
  const account = useDemoAccount()
  const isGuardian = account.profilePath === '/perfil?tipo=responsavel'
  const requestsQuery = useAdoptionRequests()
  const requestCount =
    requestsQuery.data?.filter((item) => isActiveRequest(item.status)).length ?? 0
  const [open, setOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const favoriteCount = useFavoriteIds().data?.length ?? 0
  const receivedRequestCount =
    useReceivedRequests(account.isAuthenticated && isGuardian).data?.filter((item) =>
      ['Enviada', 'Em análise'].includes(item.status),
    ).length ?? 0
  const savedName = profileName.trim()
  const initials = savedName ? getInitials(savedName) : ''
  const firstName = savedName.split(/\s+/)[0]

  const nav: [string, string][] =
    account.isAuthenticated && isGuardian
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

  const logout = () => {
    account.logout()
    queryClient.clear()
    setAccountMenuOpen(false)
    setOpen(false)
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
              <Link
                className="rounded-[9px] bg-coral px-4 py-3 text-center text-sm font-bold text-white md:hidden"
                to="/criar-conta"
                onClick={() => setOpen(false)}
              >
                Entrar ou criar conta
              </Link>
            )}
            {account.isAuthenticated && (
              <button
                className="flex border-0 bg-transparent px-3 py-[15px] text-left text-sm font-semibold text-[#52625a] md:hidden"
                type="button"
                onClick={logout}
              >
                Sair
              </button>
            )}
          </nav>

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
            <Link
              className="hidden rounded-lg bg-coral px-4 py-2.5 text-sm font-bold text-white md:inline-flex"
              to="/criar-conta"
            >
              Entrar ou criar conta
            </Link>
          )}
        </Container>
      </header>
      <main className="flex-1">{children}</main>
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
