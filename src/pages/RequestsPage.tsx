import { CalendarDays, ChevronRight, ClipboardList, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageIntro, StatusPill } from '../components/UI'
import { usePets } from '../hooks/usePets'
import type { AdoptionRequest } from '../types'

interface RequestsPageProps {
  requests: AdoptionRequest[]
  onCancel: (requestId: string) => Promise<AdoptionRequest>
}

export function RequestsPage({ requests, onCancel }: RequestsPageProps) {
  const petsQuery = usePets({ limit: 100 })

  if (petsQuery.isPending) return <div className="app-feedback">Carregando solicitações...</div>
  if (petsQuery.isError) return <div className="app-feedback error" role="alert"><div><p>Não foi possível carregar os pets das solicitações.</p><button className="button ghost" onClick={() => void petsQuery.refetch()}>Tentar novamente</button></div></div>

  const pets = petsQuery.data.pages.flatMap((page) => page.data)
  return (
    <div className="page-surface">
      <section className="container page-section">
        <PageIntro
          eyebrow="Acompanhamento"
          title="Minhas solicitações"
          description="Veja o andamento das suas adoções e as próximas etapas de cada processo."
        />
        {requests.length ? (
          <div className="requests-list">
            {requests.map((request) => {
              const pet = pets.find((item) => item.id === request.petId)
              if (!pet) return null
              return (
                <article className="request-card" key={request.id}>
                  <img src={pet.image} alt={pet.name} />
                  <div className="request-main">
                    <div className="request-topline">
                      <div>
                        <span className="request-code">{request.id}</span>
                        <h2>{pet.name}</h2>
                      </div>
                      <StatusPill status={request.status} />
                    </div>
                    <p>{request.message}</p>
                    <div className="request-meta">
                      <span>
                        <CalendarDays size={16} /> Enviada em {request.date}
                      </span>
                      <span>
                        <MapPin size={16} /> {pet.organization}
                      </span>
                    </div>
                  </div>
                  <div className="request-actions">
                    {!['Cancelada', 'Recusada'].includes(request.status) && (
                      <button
                        className="text-button danger"
                        onClick={() => void onCancel(request.id)}
                      >
                        Cancelar
                      </button>
                    )}
                    <Link
                      className="icon-button"
                      to={`/pets/${pet.id}`}
                      aria-label={`Ver ${pet.name}`}
                    >
                      <ChevronRight />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <ClipboardList size={36} />
            <h2>Nenhuma solicitação ainda</h2>
            <p>Quando você enviar uma solicitação de adoção, ela aparecerá aqui.</p>
            <Link className="button primary" to="/pets">
              Encontrar um pet
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
