import { ArrowRight, CheckCircle2, HeartHandshake, type LucideIcon, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PetCard } from '../components/PetCard'
import type { Pet } from '../types'

interface HomePageProps {
  pets: Pet[]
  favorites: string[]
  onFavorite: (petId: string) => void
}

export function HomePage({ pets, favorites, onFavorite }: HomePageProps) {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={15} /> Adoção responsável</span>
            <h1>Encontre um amor que <em>combina</em> com a sua vida.</h1>
            <p>Conheça pets, entenda suas necessidades e descubra a compatibilidade antes de dar o próximo passo.</p>
            <div className="hero-actions">
              <Link className="button primary" to="/pets">Encontrar meu pet <ArrowRight size={18} /></Link>
              <Link className="button ghost" to="/perfil">Completar meu perfil</Link>
            </div>
            <div className="trust-row">
              <span><CheckCircle2 size={17} /> ONGs verificadas</span>
              <span><CheckCircle2 size={17} /> Processo responsável</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="Luna, uma cachorra disponível para adoção">
            <div className="hero-photo-frame">
              <img src={pets[0].image} alt="Luna, cachorra disponível para adoção" />
              {/*<div className="hero-pet-card">
                {/*<div><strong>Luna</strong><span>2 anos · São Paulo</span></div>
                <span className="match-badge"><Sparkles size={14} /> 100% match</span>
              </div>*/}
            </div>
            <div className="floating-note note-one"><HeartHandshake size={18} /><span><strong>+1.200</strong> encontros felizes</span></div>
            <div className="floating-note note-two"><ShieldCheck size={18} /><span>Cuidados verificados</span></div>
          </div>
        </div>
      </section>

      <section className="section how-section">
        <div className="container">
          <div className="section-heading centered">
            <span className="eyebrow">Como funciona</span>
            <h2>Um caminho simples para uma decisão consciente</h2>
          </div>
          <div className="how-grid">
            {(
              [
                [Search, '01', 'Explore com calma', 'Use filtros para encontrar pets que fazem sentido para sua rotina.'],
                [Sparkles, '02', 'Veja a compatibilidade', 'Comparamos seu perfil com as necessidades de cada animal.'],
                [HeartHandshake, '03', 'Comece uma história', 'Responda ao questionário e envie sua solicitação à organização.'],
              ] as [LucideIcon, string, string, string][]
            ).map(([Icon, number, title, text]) => (
              <article className="how-card" key={number}>
                <span className="how-number">{number}</span>
                <span className="icon-tile"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section featured-section">
        <div className="container">
          <div className="section-heading split">
            <div><span className="eyebrow">Novos amigos</span><h2>Esperando por uma família</h2></div>
            <Link className="text-link" to="/pets">Ver todos os pets <ArrowRight size={17} /></Link>
          </div>
          <div className="pet-grid featured-grid">
            {pets.slice(0, 3).map((pet) => (
              <PetCard key={pet.id} pet={pet} favorite={favorites.includes(pet.id)} onFavorite={onFavorite} />
            ))}
          </div>
        </div>
      </section>

      <section className="container cta-section">
        <div>
          <span className="eyebrow light">Seu perfil faz a diferença</span>
          <h2>Quanto mais sabemos sobre sua rotina, melhor fica o encontro.</h2>
        </div>
        <Link className="button cream" to="/perfil">Preencher meu perfil <ArrowRight size={18} /></Link>
      </section>
    </>
  )
}
