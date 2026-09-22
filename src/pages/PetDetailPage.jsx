import { ArrowLeft, Check, Heart, Home, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { FlowSteps } from '../components/FlowSteps'

export function PetDetailPage({ pets, favorites, onFavorite }) {
  const { petId } = useParams()
  const pet = pets.find((item) => item.id === petId)
  if (!pet) return <Navigate to="/pets" replace />
  const isFavorite = favorites.includes(pet.id)
  const gallery = pet.gallery?.length ? pet.gallery : [pet.image, pet.image, pet.image]


  return (
    <div className="page-surface">
      <section className="container detail-page">
        <Link to="/pets" className="back-link"><ArrowLeft size={17} /> Voltar para os pets</Link>
        <FlowSteps current={0} />
        <div className="detail-grid">
          <div>
            <div className="gallery">
              <img className="gallery-main" src={gallery[0]} alt={`${pet.name} em destaque`} />
              <img src={gallery[1]} alt={`${pet.name} em outro momento`} />
              <img src={gallery[2]} alt={`${pet.name} brincando`} />
            </div>
            <div className="detail-content">
              <div className="detail-title-row">
                <div><span className="eyebrow">Conheça {pet.name}</span><h1>{pet.name}</h1><p>{pet.breed} · {pet.ageLabel} · {pet.size} · {pet.sex}</p></div>
                <button className={isFavorite ? 'favorite-label active' : 'favorite-label'} onClick={() => onFavorite(pet.id)}><Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Favoritado' : 'Favoritar'}</button>
              </div>
              <div className="trait-list large">{pet.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
              <section className="content-block"><h2>Minha história</h2><p>{pet.description}</p></section>
              <section className="content-block"><h2>O que eu preciso</h2>
                <div className="needs-grid">
                  <div><span className="need-icon"><Sparkles /></span><span><strong>Nível de energia</strong>{pet.energy}</span></div>
                  <div><span className="need-icon"><Home /></span><span><strong>Espaço ideal</strong>{pet.space}</span></div>
                  <div><span className="need-icon"><Check /></span><span><strong>Convive com crianças</strong>{pet.children ? 'Sim' : 'Prefere sem crianças'}</span></div>
                  <div><span className="need-icon"><Heart /></span><span><strong>Convive com outros pets</strong>{pet.otherPets ? 'Sim' : 'Prefere ser único pet'}</span></div>
                </div>
              </section>
            </div>
          </div>
          <aside className="adoption-card">
            <div className="org-row"><span className="org-avatar">{pet.organizationInitials}</span><span><small>Responsável</small><strong>{pet.organization}</strong></span><ShieldCheck size={19} /></div>
            <div className="location-row"><MapPin size={18} /><span><strong>{pet.city}</strong><small>A aproximadamente {pet.distance}</small></span></div>
            <div className="adoption-divider" />
            <span className="eyebrow"><Sparkles size={14} /> Próximo passo</span>
            <h2>Vocês combinam?</h2>
            <p>Compare sua rotina com as necessidades de {pet.name} e veja os pontos fortes desse encontro.</p>
            <Link className="button primary full" to={`/pets/${pet.id}/compatibilidade`}>Ver compatibilidade <Sparkles size={18} /></Link>
            <p className="fine-print">O resultado é orientativo e não garante a aprovação da adoção.</p>
          </aside>
        </div>
      </section>
    </div>
  )
}
