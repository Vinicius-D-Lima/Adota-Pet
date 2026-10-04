import { Heart, MapPin } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useFavorite } from '../hooks/useFavorites'
import type { Pet } from '../types'

interface PetCardProps {
  pet: Pet
  /** Nível do título do cartão: h2 em páginas cujo título é h1, h3 abaixo de uma seção h2. */
  headingLevel?: 'h2' | 'h3'
}

export function PetCard({ pet, headingLevel: Heading = 'h3' }: PetCardProps) {
  const { isFavorite, toggle, isPending } = useFavorite(pet.id)
  const location = useLocation()
  const from = `${location.pathname}${location.search}`

  return (
    <article className="pet-card">
      <div className="pet-image-wrap">
        <img src={pet.image} alt={`${pet.name}, ${pet.breed}`} className="pet-image" />
        <button
          className={isFavorite ? 'favorite active' : 'favorite'}
          onClick={toggle}
          aria-pressed={isFavorite}
          aria-busy={isPending}
          aria-label={isFavorite ? `Remover ${pet.name} dos favoritos` : `Favoritar ${pet.name}`}
        >
          <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        {pet.distance && (
          <span className="pet-distance">
            <MapPin size={13} /> {pet.distance}
          </span>
        )}
      </div>
      <div className="pet-card-body">
        <div className="pet-card-heading">
          <Heading>{pet.name}</Heading>
          <span>{pet.sex}</span>
        </div>
        <p className="pet-meta">
          {pet.breed} · {pet.ageLabel} · {pet.size}
        </p>
        <p className="pet-summary">{pet.summary}</p>
        <div className="trait-list">
          {pet.traits.slice(0, 3).map((trait) => (
            <span key={trait}>{trait}</span>
          ))}
        </div>
        <Link to={`/pets/${pet.id}`} state={{ from }} className="text-link">
          Conhecer {pet.name} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}

export function PetCardSkeleton() {
  return (
    <article className="pet-card pet-card-skeleton" aria-hidden="true">
      <div className="pet-image-wrap skeleton-block" />
      <div className="pet-card-body">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-meta" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-short" />
      </div>
    </article>
  )
}
