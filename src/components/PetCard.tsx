import { Heart, MapPin } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFavorite } from '../hooks/useFavorites'
import { hasDemoAccount } from '../lib/demoAccount'
import type { Pet } from '../types'
import { HealthBadges } from './HealthBadges'
import { Card, TextLink, cx } from './ui'

interface PetCardProps {
  pet: Pet
}

export function TraitList({ traits, large = false }: { traits: string[]; large?: boolean }) {
  return (
    <div className="mb-[19px] mt-4 flex flex-wrap gap-1.5">
      {traits.map((trait) => (
        <span
          key={trait}
          className={cx(
            'rounded-lg bg-forest-50 font-semibold text-forest-700',
            large ? 'px-3 py-2 text-xs' : 'px-[9px] py-1.5 text-[11px]',
          )}
        >
          {trait}
        </span>
      ))}
    </div>
  )
}

export function PetCard({ pet }: PetCardProps) {
  const { isFavorite, toggle, isPending } = useFavorite(pet.id)
  const location = useLocation()
  const navigate = useNavigate()
  const from = `${location.pathname}${location.search}`
  const petPath = `/pets/${pet.id}`
  const hasAccount = hasDemoAccount()
  const accessPath = '/criar-conta'
  const canInteract = hasAccount

  const handleFavorite = () => {
    if (canInteract) toggle()
    else navigate(accessPath, { state: { from: petPath } })
  }

  return (
    <Card
      as="article"
      className="group min-w-0 overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="relative aspect-[1.2] overflow-hidden bg-[#e8eee9]">
        <img
          src={pet.image}
          alt={`${pet.name}, ${pet.breed}`}
          className="size-full object-cover transition duration-[400ms] group-hover:scale-[1.035]"
          width={600}
          height={500}
          loading="lazy"
        />
        <button
          className={cx(
            'absolute right-3.5 top-3.5 grid size-[39px] cursor-pointer place-items-center rounded-full border-0 bg-white/90',
            isFavorite ? 'text-coral' : 'text-forest-800',
          )}
          onClick={handleFavorite}
          aria-pressed={isFavorite}
          aria-busy={isPending}
          aria-label={isFavorite ? `Remover ${pet.name} dos favoritos` : `Favoritar ${pet.name}`}
        >
          <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        {pet.distance && (
          <span className="absolute bottom-[13px] left-[13px] inline-flex items-center gap-1 rounded-lg bg-[#1c352b]/80 px-[9px] py-1.5 text-[11px] text-white">
            <MapPin size={13} /> {pet.distance}
          </span>
        )}
      </div>
      <div className="p-[21px]">
        <div className="flex items-center justify-between gap-3.5">
          <h3 className="mb-1 font-display text-[27px] tracking-[-0.035em]">{pet.name}</h3>
          <span className="text-xs text-muted">{pet.sex}</span>
        </div>
        <p className="text-xs text-muted">
          {pet.breed} · {pet.ageLabel} · {pet.size}
        </p>
        <HealthBadges pet={pet} />
        <p className="min-h-12 text-sm leading-[1.55] text-[#53635b]">{pet.summary}</p>
        <TraitList traits={pet.traits.slice(0, 3)} />
        <TextLink
          to={canInteract ? petPath : accessPath}
          state={{ from: canInteract ? from : petPath }}
        >
          Conhecer {pet.name} <span aria-hidden="true">→</span>
        </TextLink>
      </div>
    </Card>
  )
}

const skeleton = 'animate-pulse bg-[#e5ebe6]'

export function PetCardSkeleton() {
  return (
    <Card as="article" className="min-w-0 overflow-hidden" aria-hidden="true">
      <div className={cx('aspect-[1.2]', skeleton)} />
      <div className="p-[21px]">
        <div className={cx('mb-[13px] h-[26px] w-[48%] rounded-full', skeleton)} />
        <div className={cx('mb-[13px] h-[13px] w-[72%] rounded-full', skeleton)} />
        <div className={cx('mb-[13px] h-[13px] rounded-full', skeleton)} />
        <div className={cx('mb-[13px] h-[13px] w-[58%] rounded-full', skeleton)} />
      </div>
    </Card>
  )
}
