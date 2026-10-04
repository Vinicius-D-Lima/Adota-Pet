import { Link } from 'react-router-dom'

interface NotFoundStateProps {
  title: string
  message: string
  to: string
  linkLabel: string
}

export function NotFoundState({ title, message, to, linkLabel }: NotFoundStateProps) {
  return (
    <div className="page-surface">
      <section className="container detail-page">
        <div className="empty-state" role="alert">
          <h1>{title}</h1>
          <p>{message}</p>
          <Link className="button primary" to={to}>
            {linkLabel}
          </Link>
        </div>
      </section>
    </div>
  )
}
