import { Heart, Menu, PawPrint, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { getInitials } from '../utils/getInitials'

interface LayoutProps {
  children: ReactNode
  profileName: string
  requestCount: number
}

export function Layout({ children, profileName, requestCount }: LayoutProps) {
  const [open, setOpen] = useState(false)
  const savedName = profileName.trim()
  const initials = savedName ? getInitials(savedName) : ''
  const firstName = savedName.split(/\s+/)[0]

  const nav: [string, string][] = [
    ['/', 'Início'],
    ['/pets', 'Encontrar pets'],
    ['/solicitacoes', 'Minhas solicitações'],
    ['/perfil', 'Meu perfil'],
  ]

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="AdotaPet — início">
            <span className="brand-mark">
              <PawPrint size={21} strokeWidth={2.5} />
            </span>
            <span>
              Adota<span>Pet</span>
            </span>
          </Link>

          <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menu">
            {open ? <X /> : <Menu />}
          </button>

          <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Navegação principal">
            {nav.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {label}
                {to === '/solicitacoes' && requestCount > 0 && (
                  <span className="nav-count">{requestCount}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {savedName && (
            <Link
              className="user-chip"
              to="/perfil"
              aria-label={`Abrir perfil de ${savedName}`}
              title={savedName}
            >
              <span className="user-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="user-greeting">
                Olá,
                <br />
                bem-vindo {firstName}
              </span>
            </Link>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <Link to="/" className="brand brand-footer">
              <span className="brand-mark">
                <PawPrint size={20} />
              </span>
              <span>
                Adota<span>Pet</span>
              </span>
            </Link>
            <p>Adoção responsável começa com um bom encontro.</p>
          </div>
          <p className="footer-note">
            <Heart size={15} fill="currentColor" /> Feito para aproximar famílias e pets.
          </p>
        </div>
      </footer>
    </div>
  )
}
