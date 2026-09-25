import { Heart, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Pet } from '../types'

interface PetCardProps {
  pet: Pet
  favorite: boolean
  onFavorite: (petId: string) => void
}

export function PetCard({ pet, favorite, onFavorite }: PetCardProps) {
  const idPet = pet.id;
  console.log("id do pet",idPet);
  return (
    <article className="pet-card">
      <div className="pet-image-wrap">
        <img src={pet.image} alt={`${pet.name}, ${pet.breed}`} className="pet-image" />
        <button
          className={favorite ? 'favorite active' : 'favorite'}
          onClick={() => onFavorite(pet.id)}
          aria-label={favorite ? `Remover ${pet.name} dos favoritos` : `Favoritar ${pet.name}`}
        >
          <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <span className="pet-distance"><MapPin size={13} /> {pet.distance}</span>
      </div>
      <div className="pet-card-body">
        <div className="pet-card-heading">
          <h3>{pet.name}</h3>
          <span>{pet.sex}</span>
        </div>
        <p className="pet-meta">{pet.breed} · {pet.ageLabel} · {pet.size}</p>
        <p className="pet-summary">{pet.summary}</p>
        <div className="trait-list">
          {pet.traits.slice(0, 3).map((trait) => <span key={trait}>{trait}</span>)}
        </div>
        <Link to={`/pets/${pet.id}`} className="text-link">Conhecer {pet.name} <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  )
}
