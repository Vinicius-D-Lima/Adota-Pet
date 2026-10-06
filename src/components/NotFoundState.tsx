import { Container, EmptyState, LinkButton, PageSurface } from './ui'

interface NotFoundStateProps {
  title: string
  message: string
  to: string
  linkLabel: string
}

export function NotFoundState({ title, message, to, linkLabel }: NotFoundStateProps) {
  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <EmptyState headingAs="h1" title={title} description={message} role="alert">
          <LinkButton to={to}>{linkLabel}</LinkButton>
        </EmptyState>
      </Container>
    </PageSurface>
  )
}
