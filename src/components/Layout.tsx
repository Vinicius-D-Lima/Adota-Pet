import { Heart, Menu, PawPrint, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAdoptionRequests } from '../hooks/useAdoptionRequests'
import { useFavoriteIds } from '../hooks/useFavorites'
import { getInitials } from '../utils/getInitials'
import { isActiveRequest } from '../utils/requestStatus'
import { FavoriteNotice } from './FavoriteNotice'
import { Container, cx } from './ui'

interface LayoutProps {
  children: ReactNode
  profileName: string
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

export function Layout({ children, profileName }: LayoutProps) {
  const requestsQuery = useAdoptionRequests()
  const requestCount =
    requestsQuery.data?.filter((item) => isActiveRequest(item.status)).length ?? 0
  const [open, setOpen] = useState(false)
  const favoriteCount = useFavoriteIds().data?.length ?? 0
  const savedName = profileName.trim()
  const initials = savedName ? getInitials(savedName) : ''
  const firstName = savedName.split(/\s+/)[0]

  const nav: [string, string][] = [
    ['/', 'Início'],
    ['/pets', 'Encontrar pets'],
    ['/favoritos', 'Favoritos'],
    ['/solicitacoes', 'Minhas solicitações'],
    ['/perfil', 'Meu perfil'],
  ]

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
              </NavLink>
            ))}
          </nav>

          {savedName && (
            <Link
              className="hidden items-center gap-2 text-forest-800 md:flex"
              to="/perfil"
              aria-label={`Abrir perfil de ${savedName}`}
              title={savedName}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-forest-100 text-xs font-bold"
                aria-hidden="true"
              >
                {initials}
              </span>
              <span className="whitespace-nowrap text-xs font-semibold">
                Olá,
                <br />
                bem-vindo {firstName}
              </span>
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
