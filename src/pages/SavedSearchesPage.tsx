import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Container, EmptyState, PageIntro, PageSurface } from '../components/ui'
import {
  useSavedSearches,
  type SavedSearch,
  type SavedSearchCriteria,
} from '../hooks/useSavedSearches'

function getSearchQuery(criteria: SavedSearchCriteria) {
  const params = new URLSearchParams()

  if (criteria.search) params.set('search', criteria.search)
  if (criteria.species) params.set('species', criteria.species)
  criteria.size?.forEach((size) => params.append('size', size))
  if (criteria.sex) params.set('sex', criteria.sex)
  if (criteria.city) params.set('city', criteria.city)

  return params.toString()
}

function getCriteriaSummary(criteria: SavedSearchCriteria) {
  return [
    criteria.search && `Busca: ${criteria.search}`,
    criteria.species,
    ...(criteria.size ?? []),
    criteria.sex,
    criteria.city,
  ]
    .filter(Boolean)
    .join(' · ')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Tente novamente.'
}

export function SavedSearchesPage() {
  const navigate = useNavigate()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [operationMessage, setOperationMessage] = useState('')
  const [operationError, setOperationError] = useState(false)
  const { searches, isPending, isError, error, refetch, deleteSearch, updateSearch } =
    useSavedSearches()

  const performAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> => {
    try {
      await action()
      setOperationError(false)
      setOperationMessage(successMessage)
      return true
    } catch (actionError) {
      setOperationError(true)
      setOperationMessage(`Não foi possível atualizar a busca. ${errorMessage(actionError)}`)
      return false
    }
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <PageIntro
          eyebrow="Minhas buscas"
          title="Buscas salvas"
          description="Gerencie suas buscas favoritas e os alertas associados."
        />

        {operationMessage && (
          <p
            className={`mb-4 text-sm ${operationError ? 'text-[#a33f2d]' : 'text-forest-700'}`}
            role={operationError ? 'alert' : 'status'}
          >
            {operationMessage}
          </p>
        )}

        {isPending ? (
          <p role="status">Carregando suas buscas salvas...</p>
        ) : isError ? (
          <EmptyState
            title="Não foi possível carregar suas buscas"
            description={errorMessage(error)}
            role="alert"
          >
            <Button onClick={() => void refetch()}>Tentar novamente</Button>
          </EmptyState>
        ) : searches.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="mb-4">Você ainda não possui buscas salvas.</p>

            <Link to="/pets">
              <Button>Encontrar pets</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4">
            {searches.map((search: SavedSearch) => (
              <Card key={search.id} className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    {editingId === search.id ? (
                      <label className="block">
                        <span className="sr-only">Nome da busca</span>
                        <input
                          value={editingName}
                          maxLength={80}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="rounded border px-2 py-1"
                        />
                      </label>
                    ) : (
                      <h2 className="mb-1 text-lg font-semibold">{search.name}</h2>
                    )}

                    <p className="mb-2 text-sm text-muted">{getCriteriaSummary(search.criteria)}</p>
                    <p className="text-sm text-muted">
                      Alertas: {search.active ? 'Ativos' : 'Desativados'}
                    </p>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        void performAction(
                          () => updateSearch(search.id, { active: !search.active }),
                          search.active ? 'Alerta desativado.' : 'Alerta ativado.',
                        )
                      }
                    >
                      {search.active ? 'Desativar alerta' : 'Ativar alerta'}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const query = getSearchQuery(search.criteria)
                        navigate(query ? `/pets?${query}` : '/pets')
                      }}
                    >
                      Aplicar
                    </Button>

                    {editingId === search.id ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const newName = editingName.trim()
                          if (!newName) {
                            setOperationError(true)
                            setOperationMessage('Informe um nome para a busca.')
                            return
                          }

                          void performAction(
                            () => updateSearch(search.id, { name: newName }),
                            'Nome da busca atualizado.',
                          ).then((saved) => {
                            if (saved) {
                              setEditingId(null)
                              setEditingName('')
                            }
                          })
                        }}
                      >
                        Salvar nome
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(search.id)
                          setEditingName(search.name)
                          setOperationMessage('')
                        }}
                      >
                        Renomear
                      </Button>
                    )}

                    <Button
                      variant="text"
                      onClick={() =>
                        void performAction(() => deleteSearch(search.id), 'Busca excluída.')
                      }
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
