import { Link, useNavigate } from 'react-router-dom'
import { Container, PageIntro, PageSurface, Card, Button } from '../components/ui'
import { useSavedSearches, type SavedSearch } from '../hooks/useSavedSearches'

function getSearchQuery(filters: SavedSearch['filters']) {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.species) params.set('species', filters.species)
  filters.size?.forEach((size) => params.append('size', size))
  if (filters.sex) params.set('sex', filters.sex)
  if (filters.sort) params.set('sort', filters.sort)

  return params.toString()
}

export function SavedSearchesPage() {
  const navigate = useNavigate()
  const {
    searches,
    deleteSearch,
    toggleAlert,
  } = useSavedSearches()

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <PageIntro
          eyebrow="Minhas buscas"
          title="Buscas salvas"
          description="Gerencie suas buscas favoritas e os alertas associados."
        />

        {searches.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="mb-4">
              Você ainda não possui buscas salvas.
            </p>

            <Link to="/pets">
              <Button>
                Encontrar pets
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4">
            {searches.map((search) => (
              <Card key={search.id} className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="mb-1 text-lg font-semibold">
                      {search.name}
                    </h2>

                    <p className="text-sm text-muted">
                      Alertas: {search.alertsEnabled ? 'Ativos' : 'Desativados'}
                    </p>

                    <p className="mt-2 text-xs text-muted">
                      {[
                        search.filters.search,
                        search.filters.species,
                        search.filters.sex,
                        ...(search.filters.size ?? []),
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>

                    <Button
                      variant="secondary"
                      onClick={() => toggleAlert(search.id)}
                    >
                      {search.alertsEnabled
                        ? 'Desativar alerta'
                        : 'Ativar alerta'}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const query = getSearchQuery(search.filters)
                        navigate(query ? `/pets?${query}` : '/pets')
                      }}
                    >
                      Aplicar
                    </Button>

                    <Button
                      variant="text"
                      onClick={() => deleteSearch(search.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </PageSurface>
  )
}