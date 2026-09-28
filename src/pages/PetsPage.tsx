import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PetCard } from '../components/PetCard'
import { PageIntro } from '../components/UI'
import type { Pet } from '../types'

interface PetsPageProps {
  pets: Pet[]
  favorites: string[]
  onFavorite: (petId: string) => void
}

interface Filters {
  search: string
  species: string
  size: string
  sex: string
}

const initialFilters: Filters = { search: '', species: 'Todos', size: 'Todos', sex: 'Todos' }

export function PetsPage({ pets, favorites, onFavorite }: PetsPageProps) {
  const [filters, setFilters] = useState<Filters>(initialFilters)

  const filteredPets = useMemo(() => pets.filter((pet) => {
    const search = filters.search.toLowerCase()
    return (!search || `${pet.name} ${pet.breed} ${pet.city}`.toLowerCase().includes(search))
      && (filters.species === 'Todos' || pet.species === filters.species)
      && (filters.size === 'Todos' || pet.size === filters.size)
      && (filters.sex === 'Todos' || pet.sex === filters.sex)
  }), [filters, pets])

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }))
  const hasFilters = (Object.entries(filters) as [keyof Filters, string][]).some(([key, value]) => value !== initialFilters[key])

  return (
    <div className="page-surface">
      <section className="container page-section">
        <PageIntro eyebrow="Encontre seu companheiro" title="Pets esperando por você" description="Explore, filtre e conheça histórias. O encontro certo pode estar mais perto do que você imagina." />
        <div className="filter-panel">
          <label className="search-box">
            <Search size={20} />
            <input value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder="Busque por nome, raça ou cidade" />
          </label>
          <div className="select-filters">
            <span className="filter-title"><SlidersHorizontal size={17} /> Filtrar por</span>
            <select value={filters.species} onChange={(event) => update('species', event.target.value)} aria-label="Filtrar por espécie">
              <option>Todos</option><option>Cachorro</option><option>Gato</option>
            </select>
            <select value={filters.size} onChange={(event) => update('size', event.target.value)} aria-label="Filtrar por porte">
              <option>Todos</option><option>Pequeno</option><option>Médio</option><option>Grande</option>
            </select>
            <select value={filters.sex} onChange={(event) => update('sex', event.target.value)} aria-label="Filtrar por sexo">
              <option>Todos</option><option>Fêmea</option><option>Macho</option>
            </select>
            {hasFilters && <button className="clear-filter" onClick={() => setFilters(initialFilters)}><X size={15} /> Limpar</button>}
          </div>
        </div>
        <div className="results-bar">
          <p><strong>{filteredPets.length}</strong> {filteredPets.length === 1 ? 'pet encontrado' : 'pets encontrados'}</p>
          <span>Mais próximos primeiro</span>
        </div>
        {filteredPets.length ? (
          <div className="pet-grid">
            {filteredPets.map((pet) => <PetCard key={pet.id} pet={pet} favorite={favorites.includes(pet.id)} onFavorite={onFavorite} />)}
          </div>
        ) : (
          <div className="empty-state"><Search size={34} /><h2>Nenhum pet encontrado</h2><p>Tente remover algum filtro ou buscar por outro termo.</p><button className="button primary" onClick={() => setFilters(initialFilters)}>Limpar filtros</button></div>
        )}
      </section>
    </div>
  )
}
