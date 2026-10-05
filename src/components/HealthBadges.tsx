import { Check, X } from 'lucide-react'
import type { Pet } from '../types'

/** Selos de vacinação e castração; os dois estados aparecem para não deixar dúvida. */
export function HealthBadges({ pet }: { pet: Pick<Pet, 'vaccinated' | 'neutered'> }) {
  const items = [
    [pet.vaccinated, 'Vacinado', 'Não vacinado'],
    [pet.neutered, 'Castrado', 'Não castrado'],
  ] as const
  return (
    <ul className="health-badges" aria-label="Saúde">
      {items.map(([done, yes, no]) => (
        <li key={yes} className={done ? undefined : 'pending'}>
          {done ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
          {done ? yes : no}
        </li>
      ))}
    </ul>
  )
}
