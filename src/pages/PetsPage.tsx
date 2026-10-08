import { Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { PetGrid } from '../components/PetGrid'
import {
  Button,
  Container,
  EmptyState,
  LinkButton,
  PageIntro,
  PageSurface,
  Select,
  cx,
} from '../components/ui'
import { useAdopterProfile } from '../hooks/useAdopterProfile'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { usePets, type PetSort } from '../hooks/usePets'
import { useSavedSearches } from '../hooks/useSavedSearches'
import { calculateCompatibility } from '../utils/calculateCompatibility'

export const PAGE_SIZE = 4

const allowed = {
  species: ['Cachorro', 'Gato'],
  size: ['Pequeno', 'Médio', 'Grande'],
  sex: ['Fêmea', 'Macho'],
  sort: ['recent', 'name', 'distance', 'compatibility'],
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
  const [visibleCompatibilityPage, setVisibleCompatibilityPage] = useState({
    key: '',
    count: PAGE_SIZE,
  })
  const searchInput = searchState.source === searchFromUrl ? searchState.value : searchFromUrl
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const species = readParam(searchParams, 'species')
  const size = allowed.size.filter((option) => searchParams.getAll('size').includes(option))
  const sizeKey = size.join(',')
  const sex = readParam(searchParams, 'sex')
  const sort = (readParam(searchParams, 'sort') || 'recent') as PetSort | 'compatibility'
  const compatibilityPageKey = [debouncedSearch.trim(), species, sizeKey, sex, sort].join('|')
  const visibleCompatibilityCount =
    visibleCompatibilityPage.key === compatibilityPageKey
      ? visibleCompatibilityPage.count
      : PAGE_SIZE

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
  const { saveSearch } = useSavedSearches()
  const [savedSearchMessage, setSavedSearchMessage] = useState('')
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
      sort: sort === 'compatibility' ? 'recent' : sort,
      limit: sort === 'compatibility' ? 100 : PAGE_SIZE,
    }),
    [debouncedSearch, sex, size, sort, species],
  )

  const petsQuery = usePets(filters)
  const pets = useMemo(() => {
    const unique = new Map(
      petsQuery.data?.pages.flatMap((page) => page.data).map((pet) => [pet.id, pet]),
    )
    const data = Array.from(unique.values())

    if (sort === 'compatibility' && profileQuery.data?.isComplete) {
      return data
        .map((pet) => ({
          pet,
          score: calculateCompatibility(pet, profileQuery.data.profile).score,
        }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.pet)
    }

    return data
  }, [petsQuery.data, sort, profileQuery.data])
  const recommendedPets = useMemo(() => {
    if (sort !== 'compatibility' || !profileQuery.data?.isComplete) return []

    return pets.map((pet) => ({
      pet,
      result: calculateCompatibility(pet, profileQuery.data.profile),
    }))
  }, [pets, profileQuery.data, sort])
  const hasMorePets =
    sort === 'compatibility'
      ? visibleCompatibilityCount < recommendedPets.length || petsQuery.hasNextPage
      : petsQuery.hasNextPage
  const total = petsQuery.data?.pages[0]?.total ?? 0
  const hasFilters = Boolean(searchFromUrl || species || size.length || sex || sort !== 'recent')

  const clearFilters = () => {
    setSearchState({ source: searchFromUrl, value: '' })
    setSearchParams({}, { replace: false })
  }

  const saveCurrentSearch = () => {
    const sortLabels = {
      recent: 'Mais recentes',
      name: 'Nome A–Z',
      distance: 'Mais próximos',
      compatibility: 'Compatibilidade',
    }
    const name = [
      searchFromUrl && `Busca: ${searchFromUrl}`,
      species,
      ...size,
      sex,
      sort !== 'recent' && sortLabels[sort],
    ]
      .filter(Boolean)
      .join(' · ')

    const wasSaved = saveSearch({
      id: crypto.randomUUID(),
      name,
      filters: {
        search: searchFromUrl || undefined,
        species: species || undefined,
        size: size.length ? size : undefined,
        sex: sex || undefined,
        sort: sort === 'recent' ? undefined : sort,
      },
      alertsEnabled: false,
    })
    setSavedSearchMessage(
      wasSaved
        ? 'Busca salva com sucesso.'
        : 'Você atingiu o limite de 10 buscas salvas.',
    )
  }

  const filterSelect = 'h-[43px] w-auto rounded-[9px] bg-white py-0 pl-3 pr-9'

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <PageIntro
          eyebrow="Encontre seu companheiro"
          title="Pets esperando por você"
          description="Explore, filtre e conheça histórias. O encontro certo pode estar mais perto do que você imagina."
        />
        <div className="rounded-[18px] border border-line bg-white p-[18px] shadow-[0_10px_34px_rgba(30,60,48,0.06)]">
          <label className="flex h-[49px] items-center gap-2.5 rounded-[11px] border border-line px-3.5 text-muted focus-within:border-forest-700 focus-within:ring-[3px] focus-within:ring-forest-700/10">
            <Search size={20} />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-ink outline-0"
              value={searchInput}
              onChange={(event) =>
                setSearchState({ source: searchFromUrl, value: event.target.value })
              }
              placeholder="Busque por nome, raça ou cidade"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2.5 pt-3.5">
            <span className="mr-[5px] flex w-full items-center gap-[7px] text-xs font-bold text-muted sm:w-auto">
              <SlidersHorizontal size={17} /> Filtrar por
            </span>
            <Select
              className={filterSelect}
              value={species}
              onChange={(event) => setFilter('species', event.target.value)}
              aria-label="Filtrar por espécie"
            >
              <option value="">Todas as espécies</option>
              <option>Cachorro</option>
              <option>Gato</option>
            </Select>
            <div className="inline-flex gap-1.5" role="group" aria-label="Filtrar por porte">
              {allowed.size.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cx(
                    'h-[43px] cursor-pointer rounded-[9px] border px-3.5 text-xs font-bold',
                    size.includes(option)
                      ? 'border-forest-700 bg-forest-100 text-forest-700'
                      : 'border-line bg-white text-forest-800',
                  )}
                  aria-pressed={size.includes(option)}
                  onClick={() => toggleSize(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <Select
              className={filterSelect}
              value={sex}
              onChange={(event) => setFilter('sex', event.target.value)}
              aria-label="Filtrar por sexo"
            >
              <option value="">Todos os sexos</option>
              <option>Fêmea</option>
              <option>Macho</option>
            </Select>
            <Select
              className={filterSelect}
              value={sort}
              onChange={(event) => setFilter('sort', event.target.value)}
              aria-label="Ordenar pets"
            >
              <option value="recent">Mais recentes</option>
              <option value="name">Nome A–Z</option>
              <option value="distance">Mais próximos</option>
              <option value="compatibility" disabled={!profileQuery.data?.isComplete}>
                Compatibilidade
              </option>
            </Select>
            {hasFilters && (
              <Button variant="text" className="sm:ml-auto" onClick={clearFilters}>
                <X size={15} /> Limpar
              </Button>
            )}
            {hasFilters && (
              <Button variant="secondary" onClick={saveCurrentSearch}>
                Salvar busca
              </Button>
            )}
          </div>
          {savedSearchMessage && (
            <p className="mt-2 text-xs text-forest-700" role="status">
              {savedSearchMessage}
            </p>
          )}
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={applyPreferences}
              disabled={!hasPreferences}
              aria-describedby="preferences-help"
            >
              <Sparkles size={16} /> Usar minhas preferências
            </Button>
            <small id="preferences-help" className="text-[11px] text-muted">
              {profileQuery.isPending
                ? 'Carregando seu perfil...'
                : hasPreferences
                  ? 'Aplica a espécie e o porte informados no seu perfil.'
                  : 'Informe espécie ou porte de preferência no seu perfil para usar este atalho.'}
            </small>
          </div>
        </div>
        <div className="mb-[18px] mt-7 flex items-center justify-between text-[13px] text-muted">
          <p className="mb-0 text-ink">
            <strong>{total}</strong> {total === 1 ? 'pet encontrado' : 'pets encontrados'}
          </p>
          <span>
            {sort === 'distance'
              ? 'Ordenados por distância'
              : sort === 'name'
                ? 'Ordenados por nome'
                : sort === 'compatibility'
                  ? 'Ordenados por compatibilidade'
                  : 'Mais recentes primeiro'}
          </span>
        </div>

        {petsQuery.isPending ? (
          <PetGrid aria-label="Carregando pets">
            {Array.from({ length: PAGE_SIZE }, (_, index) => (
              <PetCardSkeleton key={index} />
            ))}
          </PetGrid>
        ) : petsQuery.isError ? (
          <EmptyState
            title="Não foi possível carregar os pets"
            description="Verifique sua conexão e tente novamente."
            role="alert"
          >
            <Button onClick={() => void petsQuery.refetch()}>Tentar novamente</Button>
          </EmptyState>
        ) : sort === 'compatibility' && !profileQuery.data?.isComplete ? (
          <EmptyState
            title="Complete seu perfil para ordenar por compatibilidade"
            description="Precisamos conhecer sua rotina e preferências para calcular as melhores combinações."
          >
            <LinkButton to="/perfil">Completar perfil</LinkButton>
          </EmptyState>
        ) : pets.length ? (
          <>
            <PetGrid>
              {sort === 'compatibility'
                ? recommendedPets
                    .slice(0, visibleCompatibilityCount)
                    .map(({ pet, result }) => (
                      <PetCard
                        key={pet.id}
                        pet={pet}
                        compatibilityScore={result.score}
                        compatibilityLevel={result.level}
                      />
                    ))
                : pets.map((pet) => <PetCard key={pet.id} pet={pet} />)}
              {sort !== 'compatibility' &&
                petsQuery.isFetchingNextPage &&
                Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <PetCardSkeleton key={`next-${index}`} />
                ))}
            </PetGrid>
            {hasMorePets && (
              <div className="flex justify-center pt-[34px]">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (sort === 'compatibility' && visibleCompatibilityCount < pets.length) {
                      setVisibleCompatibilityPage({
                        key: compatibilityPageKey,
                        count: visibleCompatibilityCount + PAGE_SIZE,
                      })
                    } else if (petsQuery.hasNextPage) {
                      void petsQuery.fetchNextPage()
                    }
                  }}
                  disabled={petsQuery.isFetchingNextPage}
                >
                  {petsQuery.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Search size={34} />}
            title="Nenhum pet encontrado"
            description="Tente remover algum filtro ou buscar por outro termo."
          >
            <Button onClick={clearFilters}>Limpar filtros</Button>
          </EmptyState>
        )}
      </Container>
    </PageSurface>
  )
}
