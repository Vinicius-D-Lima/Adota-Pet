import { Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { PageIntro } from '../components/UI'
import { useAdopterProfile } from '../hooks/useAdopterProfile'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePets, type PetSort } from '../hooks/usePets'

export const PAGE_SIZE = 4

const allowed = {
  species: ['Cachorro', 'Gato'],
  size: ['Pequeno', 'Médio', 'Grande'],
  sex: ['Fêmea', 'Macho'],
  sort: ['recent', 'name', 'distance'],
} as const

type PetSize = (typeof allowed.size)[number]

/** Traduz as preferências do perfil em filtros; "Sem preferência" não filtra. */
const sizesByPreference: Record<string, PetSize[]> = {
  Pequeno: ['Pequeno'],
  'Pequeno ou médio': ['Pequeno', 'Médio'],
  'Médio ou grande': ['Médio', 'Grande'],
}

const readParam = (params: URLSearchParams, key: keyof typeof allowed) => {
  const value = params.get(key) ?? ''
  return (allowed[key] as readonly string[]).includes(value) ? value : ''
}

export function PetsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchFromUrl = searchParams.get('search') ?? ''
  const [searchState, setSearchState] = useState({ source: searchFromUrl, value: searchFromUrl })
  const searchInput = searchState.source === searchFromUrl ? searchState.value : searchFromUrl
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const species = readParam(searchParams, 'species')
  const size = allowed.size.filter((option) => searchParams.getAll('size').includes(option))
  const sex = readParam(searchParams, 'sex')
  const sort = (readParam(searchParams, 'sort') || 'recent') as PetSort

  const setFilter = (key: string, value: string, replace = false) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (!value || (key === 'sort' && value === 'recent')) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace },
    )
  }

  const toggleSize = (option: PetSize) => {
    setSearchParams((current) => {
      const selected = allowed.size.filter((item) =>
        item === option
          ? !current.getAll('size').includes(item)
          : current.getAll('size').includes(item),
      )
      const next = new URLSearchParams(current)
      next.delete('size')
      for (const item of selected) next.append('size', item)
      return next
    })
  }

  const profileQuery = useAdopterProfile()
  const preferences = useMemo(() => {
    const profile = profileQuery.data?.profile
    const preferredSpecies = profile?.preferredSpecies
    return {
      species:
        preferredSpecies === 'Cachorro' || preferredSpecies === 'Gato' ? preferredSpecies : '',
      size: sizesByPreference[profile?.preferredSize ?? ''] ?? [],
    }
  }, [profileQuery.data])
  const hasPreferences = Boolean(preferences.species || preferences.size.length)

  const applyPreferences = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('species')
      next.delete('size')
      if (preferences.species) next.set('species', preferences.species)
      for (const item of preferences.size) next.append('size', item)
      return next
    })
  }

  useEffect(() => {
    if (debouncedSearch === searchFromUrl) return
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        const value = debouncedSearch.trim()
        if (value) next.set('search', value)
        else next.delete('search')
        return next
      },
      { replace: true },
    )
  }, [debouncedSearch, searchFromUrl, setSearchParams])

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      species: species || undefined,
      size: size.length ? size : undefined,
      sex: sex || undefined,
      sort,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, sex, size, sort, species],
  )

  const petsQuery = usePets(filters)
  const pets = useMemo(() => {
    const unique = new Map(
      petsQuery.data?.pages.flatMap((page) => page.data).map((pet) => [pet.id, pet]),
    )
    return Array.from(unique.values())
  }, [petsQuery.data])
  const total = petsQuery.data?.pages[0]?.total ?? 0
  const hasFilters = Boolean(searchFromUrl || species || size.length || sex || sort !== 'recent')

  const clearFilters = () => {
    setSearchState({ source: searchFromUrl, value: '' })
    setSearchParams({}, { replace: false })
  }

  return (
    <div className="page-surface">
      <section className="container page-section">
        <PageIntro
          eyebrow="Encontre seu companheiro"
          title="Pets esperando por você"
          description="Explore, filtre e conheça histórias. O encontro certo pode estar mais perto do que você imagina."
        />
        <div className="filter-panel">
          <label className="search-box">
            <Search size={20} />
            <input
              value={searchInput}
              onChange={(event) =>
                setSearchState({ source: searchFromUrl, value: event.target.value })
              }
              placeholder="Busque por nome, raça ou cidade"
            />
          </label>
          <div className="select-filters">
            <span className="filter-title">
              <SlidersHorizontal size={17} /> Filtrar por
            </span>
            <select
              value={species}
              onChange={(event) => setFilter('species', event.target.value)}
              aria-label="Filtrar por espécie"
            >
              <option value="">Todas as espécies</option>
              <option>Cachorro</option>
              <option>Gato</option>
            </select>
            <div className="size-toggle" role="group" aria-label="Filtrar por porte">
              {allowed.size.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={size.includes(option) ? 'active' : undefined}
                  aria-pressed={size.includes(option)}
                  onClick={() => toggleSize(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <select
              value={sex}
              onChange={(event) => setFilter('sex', event.target.value)}
              aria-label="Filtrar por sexo"
            >
              <option value="">Todos os sexos</option>
              <option>Fêmea</option>
              <option>Macho</option>
            </select>
            <select
              value={sort}
              onChange={(event) => setFilter('sort', event.target.value)}
              aria-label="Ordenar pets"
            >
              <option value="recent">Mais recentes</option>
              <option value="name">Nome A–Z</option>
              <option value="distance">Mais próximos</option>
            </select>
            {hasFilters && (
              <button className="clear-filter" onClick={clearFilters}>
                <X size={15} /> Limpar
              </button>
            )}
          </div>
          <div className="preferences-row">
            <button
              type="button"
              className="button ghost"
              onClick={applyPreferences}
              disabled={!hasPreferences}
              aria-describedby="preferences-help"
            >
              <Sparkles size={16} /> Usar minhas preferências
            </button>
            <small id="preferences-help">
              {profileQuery.isPending
                ? 'Carregando seu perfil...'
                : hasPreferences
                  ? 'Aplica a espécie e o porte informados no seu perfil.'
                  : 'Informe espécie ou porte de preferência no seu perfil para usar este atalho.'}
            </small>
          </div>
        </div>
        <div className="results-bar">
          <p>
            <strong>{total}</strong> {total === 1 ? 'pet encontrado' : 'pets encontrados'}
          </p>
          <span>
            {sort === 'distance'
              ? 'Ordenados por distância'
              : sort === 'name'
                ? 'Ordenados por nome'
                : 'Mais recentes primeiro'}
          </span>
        </div>

        {petsQuery.isPending ? (
          <div className="pet-grid" aria-label="Carregando pets">
            {Array.from({ length: PAGE_SIZE }, (_, index) => (
              <PetCardSkeleton key={index} />
            ))}
          </div>
        ) : petsQuery.isError ? (
          <div className="empty-state" role="alert">
            <h2>Não foi possível carregar os pets</h2>
            <p>Verifique sua conexão com a API simulada e tente novamente.</p>
            <button className="button primary" onClick={() => void petsQuery.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : pets.length ? (
          <>
            <div className="pet-grid">
              {pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} />
              ))}
              {petsQuery.isFetchingNextPage &&
                Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <PetCardSkeleton key={`next-${index}`} />
                ))}
            </div>
            {petsQuery.hasNextPage && (
              <div className="load-more-row">
                <button
                  className="button ghost"
                  onClick={() => void petsQuery.fetchNextPage()}
                  disabled={petsQuery.isFetchingNextPage}
                >
                  {petsQuery.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <Search size={34} />
            <h2>Nenhum pet encontrado</h2>
            <p>Tente remover algum filtro ou buscar por outro termo.</p>
            <button className="button primary" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
