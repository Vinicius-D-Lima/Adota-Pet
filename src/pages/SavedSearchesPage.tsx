import { Link } from 'react-router-dom'
import { Container, PageIntro, PageSurface, Card, Button } from '../components/ui'
import { useSavedSearches } from '../hooks/useSavedSearches'

export function SavedSearchesPage() {
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
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="mb-1 text-lg font-semibold">
                      {search.name}
                    </h2>

                    <p className="text-sm text-muted">
                      Alertas: {search.alertsEnabled ? 'Ativos' : 'Desativados'}
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

                  <div className="flex gap-2">
                    <Button variant="secondary">
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