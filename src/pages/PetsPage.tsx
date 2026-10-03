import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { PageIntro } from '../components/UI'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePets, type PetSort } from '../hooks/usePets'

export const PAGE_SIZE = 4

const allowed = {
  species: ['Cachorro', 'Gato'],
  size: ['Pequeno', 'Médio', 'Grande'],
  sex: ['Fêmea', 'Macho'],
  sort: ['recent', 'name', 'distance'],
} as const

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
  const size = readParam(searchParams, 'size')
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
      size: size || undefined,
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
  const hasFilters = Boolean(searchFromUrl || species || size || sex || sort !== 'recent')

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
            <select
              value={size}
              onChange={(event) => setFilter('size', event.target.value)}
              aria-label="Filtrar por porte"
            >
              <option value="">Todos os portes</option>
              <option>Pequeno</option>
              <option>Médio</option>
              <option>Grande</option>
            </select>
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
