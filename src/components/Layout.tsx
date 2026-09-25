import { Heart, Menu, PawPrint, UserRound, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
  requestCount: number
}

export function Layout({ children, requestCount }: LayoutProps) {
  const [open, setOpen] = useState(false)

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
            <span className="brand-mark"><PawPrint size={21} strokeWidth={2.5} /></span>
            <span>Adota<span>Pet</span></span>
          </Link>

          <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menu">
            {open ? <X /> : <Menu />}
          </button>

          <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Navegação principal">
            {nav.map(([to, label]) => (
              <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
                {label}
                {to === '/solicitacoes' && requestCount > 0 && <span className="nav-count">{requestCount}</span>}
              </NavLink>
            ))}
          </nav>

          <Link className="user-chip" to="/perfil" aria-label="Abrir perfil de Marina Costa">
            <span>MC</span>
            <UserRound size={18} />
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <Link to="/" className="brand brand-footer">
              <span className="brand-mark"><PawPrint size={20} /></span>
              <span>Adota<span>Pet</span></span>
            </Link>
            <p>Adoção responsável começa com um bom encontro.</p>
          </div>
          <p className="footer-note"><Heart size={15} fill="currentColor" /> Feito para aproximar famílias e pets.</p>
        </div>
      </footer>
    </div>
  )
}
