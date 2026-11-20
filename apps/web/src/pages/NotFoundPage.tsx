import { NotFoundState } from '../components/NotFoundState'

export function NotFoundPage() {
  return (
    <NotFoundState
      title="Página não encontrada"
      message="O endereço que você acessou não existe ou foi movido."
      to="/"
      linkLabel="Voltar ao início"
    />
  )
}
