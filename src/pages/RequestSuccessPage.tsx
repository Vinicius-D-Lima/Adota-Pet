import { Check, ClipboardList, Heart, Home } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FlowSteps } from '../components/FlowSteps'
import { useAdoptionRequest } from '../hooks/useAdoptionRequests'
import { ApiError } from '../lib/ApiError'

export function RequestSuccessPage() {
  const { requestId } = useParams()
  const requestQuery = useAdoptionRequest(requestId)

  if (requestQuery.isPending) {
    return <div className="app-feedback">Carregando solicitação...</div>
  }

  if (requestQuery.isError) {
    if (requestQuery.error instanceof ApiError && requestQuery.error.statusCode === 404) {
      return <Navigate to="/solicitacoes" replace />
    }
    return (
      <div className="app-feedback error" role="alert">
        Não foi possível carregar a solicitação. Tente novamente.
      </div>
    )
  }

  const request = requestQuery.data
  const pet = request.pet
  if (!pet) return <Navigate to="/solicitacoes" replace />

  return (
    <div className="page-surface success-page">
      <section className="container flow-page narrow-flow">
        <FlowSteps current={3} />
        <div className="success-card-main">
          <span className="success-icon">
            <Check />
          </span>
          <span className="eyebrow">Solicitação enviada</span>
          <h1>Agora é com a equipe que cuida de {pet.name}.</h1>
          <p>
            Sua solicitação <strong>{request.id}</strong> foi enviada para {pet.organization}. Você
            pode acompanhar cada atualização pelo AdotaPet.
          </p>
          <div className="success-pet">
            <img src={pet.image} alt={pet.name} />
            <div>
              <strong>{pet.name}</strong>
              <span>
                {pet.breed} · {pet.ageLabel}
              </span>
            </div>
            <span>Enviada agora</span>
          </div>
          <div className="next-steps">
            <h2>O que acontece agora?</h2>
            <div>
              <span>1</span>
              <p>
                <strong>Análise do perfil</strong>A organização revisa seu perfil, compatibilidade e
                respostas.
              </p>
            </div>
            <div>
              <span>2</span>
              <p>
                <strong>Uma boa conversa</strong>Se houver interesse, vocês combinam uma conversa ou
                visita.
              </p>
            </div>
            <div>
              <span>3</span>
              <p>
                <strong>Decisão responsável</strong>Após as etapas, a organização registra a decisão
                no sistema.
              </p>
            </div>
          </div>
          <div className="success-actions">
            <Link className="button primary" to="/solicitacoes">
              <ClipboardList size={18} /> Acompanhar solicitação
            </Link>
            <Link className="button ghost" to="/pets">
              <Heart size={18} /> Continuar explorando
            </Link>
          </div>
        </div>
        <Link className="back-home-link" to="/">
          <Home size={16} /> Voltar para o início
        </Link>
      </section>
    </div>
  )
}
