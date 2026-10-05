import { ArrowLeft, Check, Heart, Home, MapPin, ShieldCheck, Sparkles, Syringe } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ActiveRequestNotice } from '../components/ActiveRequestNotice'
import { FlowSteps } from '../components/FlowSteps'
import { useActiveRequestForPet } from '../hooks/useAdoptionRequests'
import { useFavorite } from '../hooks/useFavorites'
import { usePet } from '../hooks/usePets'
import { ApiError } from '../lib/ApiError'

export function PetDetailPage() {
  const { petId } = useParams()
  const location = useLocation()
  const petQuery = usePet(petId)
  const activeRequest = useActiveRequestForPet(petId)
  const { isFavorite, toggle, isPending: isFavoritePending } = useFavorite(petId ?? '')
  const backTo = (location.state as { from?: string } | null)?.from ?? '/pets'

  if (petQuery.isPending)
    return (
      <div className="page-surface">
        <div
          className="container detail-page detail-skeleton skeleton-block"
          aria-label="Carregando pet"
        />
      </div>
    )

  if (petQuery.isError) {
    const notFound = petQuery.error instanceof ApiError && petQuery.error.statusCode === 404
    return (
      <div className="page-surface">
        <section className="container detail-page">
          <div className="empty-state" role="alert">
            <h1>{notFound ? 'Pet não encontrado' : 'Não foi possível carregar o pet'}</h1>
            <p>
              {notFound
                ? 'Este pet não está mais disponível ou o endereço está incorreto.'
                : 'Verifique a conexão com a API simulada e tente novamente.'}
            </p>
            {notFound ? (
              <Link className="button primary" to="/pets">
                Ver outros pets
              </Link>
            ) : (
              <button className="button primary" onClick={() => void petQuery.refetch()}>
                Tentar novamente
              </button>
            )}
          </div>
        </section>
      </div>
    )
  }

  const pet = petQuery.data
  const petGallery = pet.gallery?.length ? pet.gallery : [pet.image]
  const gallery = [petGallery[0], petGallery[1] ?? petGallery[0], petGallery[2] ?? petGallery[0]]

  return (
    <div className="page-surface">
      <section className="container detail-page">
        <Link to={backTo} className="back-link">
          <ArrowLeft size={17} /> Voltar para os pets
        </Link>
        <FlowSteps current={0} />
        <div className="detail-grid">
          <div>
            <div className="gallery">
              <img
                className="gallery-main"
                src={gallery[0]}
                alt={`${pet.name} em destaque`}
                width={800}
                height={420}
                loading="lazy"
              />
              <img
                src={gallery[1]}
                alt={`${pet.name} em outro momento`}
                width={400}
                height={205}
                loading="lazy"
              />
              <img
                src={gallery[2]}
                alt={`${pet.name} brincando`}
                width={400}
                height={205}
                loading="lazy"
              />
            </div>
            <div className="detail-content">
              <div className="detail-title-row">
                <div>
                  <span className="eyebrow">Conheça {pet.name}</span>
                  <h1>{pet.name}</h1>
                  <p>
                    {pet.breed} · {pet.ageLabel} · {pet.size} · {pet.sex}
                  </p>
                </div>
                <button
                  className={isFavorite ? 'favorite-label active' : 'favorite-label'}
                  onClick={toggle}
                  aria-pressed={isFavorite}
                  aria-busy={isFavoritePending}
                >
                  <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} />{' '}
                  {isFavorite ? 'Favoritado' : 'Favoritar'}
                </button>
              </div>
              <div className="trait-list large">
                {pet.traits.map((trait) => (
                  <span key={trait}>{trait}</span>
                ))}
              </div>
              <section className="content-block">
                <h2>Minha história</h2>
                <p>{pet.description}</p>
              </section>
              <section className="content-block">
                <h2>O que eu preciso</h2>
                <div className="needs-grid">
                  <div>
                    <span className="need-icon">
                      <Sparkles />
                    </span>
                    <span>
                      <strong>Nível de energia</strong>
                      {pet.energy}
                    </span>
                  </div>
                  <div>
                    <span className="need-icon">
                      <Home />
                    </span>
                    <span>
                      <strong>Espaço ideal</strong>
                      {pet.space}
                    </span>
                  </div>
                  <div>
                    <span className="need-icon">
                      <Check />
                    </span>
                    <span>
                      <strong>Convive com crianças</strong>
                      {pet.children ? 'Sim' : 'Prefere sem crianças'}
                    </span>
                  </div>
                  <div>
                    <span className="need-icon">
                      <Heart />
                    </span>
                    <span>
                      <strong>Convive com outros pets</strong>
                      {pet.otherPets ? 'Sim' : 'Prefere ser único pet'}
                    </span>
                  </div>
                  <div>
                    <span className="need-icon">
                      <Syringe />
                    </span>
                    <span>
                      <strong>Vacinação</strong>
                      {pet.vaccinated ? 'Vacinado' : 'Não vacinado'}
                    </span>
                  </div>
                  <div>
                    <span className="need-icon">
                      <ShieldCheck />
                    </span>
                    <span>
                      <strong>Castração</strong>
                      {pet.neutered ? 'Castrado' : 'Não castrado'}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <aside className="adoption-card">
            <div className="org-row">
              <span className="org-avatar">{pet.organizationInitials}</span>
              <span>
                <small>Responsável</small>
                <strong>{pet.organization}</strong>
              </span>
              <ShieldCheck size={19} />
            </div>
            <div className="location-row">
              <MapPin size={18} />
              <span>
                <strong>{pet.city}</strong>
                {pet.distance && <small>A aproximadamente {pet.distance}</small>}
              </span>
            </div>
            <div className="adoption-divider" />
            <span className="eyebrow">
              <Sparkles size={14} /> Próximo passo
            </span>
            <h2>Vocês combinam?</h2>
            <p>
              Compare sua rotina com as necessidades de {pet.name} e veja os pontos fortes desse
              encontro.
            </p>
            {activeRequest ? (
              <ActiveRequestNotice request={activeRequest} petName={pet.name} />
            ) : (
              <>
                <Link className="button primary full" to={`/pets/${pet.id}/compatibilidade`}>
                  Ver compatibilidade <Sparkles size={18} />
                </Link>
                <p className="fine-print">
                  O resultado é orientativo e não garante a aprovação da adoção.
                </p>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
