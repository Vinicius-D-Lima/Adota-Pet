import { EmptyState, LinkButton } from './ui'

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
        <EmptyState headingAs="h1" title={title} description={message} role="alert">
          <LinkButton to={to}>{linkLabel}</LinkButton>
        </EmptyState>
      </section>
    </div>
  )
}
