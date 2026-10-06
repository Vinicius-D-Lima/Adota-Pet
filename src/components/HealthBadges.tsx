import { Check, X } from 'lucide-react'
import type { Pet } from '../types'
import { cx } from './ui'

/** Selos de vacinação e castração; os dois estados aparecem para não deixar dúvida. */
export function HealthBadges({ pet }: { pet: Pick<Pet, 'vaccinated' | 'neutered'> }) {
  const items = [
    [pet.vaccinated, 'Vacinado', 'Não vacinado'],
    [pet.neutered, 'Castrado', 'Não castrado'],
  ] as const
  return (
    <ul className="mb-2.5 flex list-none flex-wrap gap-1.5 p-0" aria-label="Saúde">
      {items.map(([done, yes, no]) => (
        <li
          key={yes}
          className={cx(
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold',
            done ? 'bg-forest-100 text-forest-700' : 'bg-[#fff0d3] text-[#98620c]',
          )}
        >
          {done ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
          {done ? yes : no}
        </li>
      ))}
    </ul>
  )
}
