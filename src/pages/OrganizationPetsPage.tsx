import { Edit3, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Container,
  EmptyState,
  Feedback,
  LinkButton,
  PageIntro,
  PageSurface,
} from '../components/ui'
import { useDeleteOrganizationPet, useOrganizationPets } from '../hooks/useOrganization'

export function OrganizationPetsPage() {
  const petsQuery = useOrganizationPets()
  const deletePet = useDeleteOrganizationPet()
  const [error, setError] = useState('')

  if (petsQuery.isPending) return <Feedback>Carregando pets...</Feedback>
  if (petsQuery.isError)
    return <Feedback error>Não foi possível carregar os pets da instituição.</Feedback>

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remover ${name} da lista de adoção?`)) return
    setError('')
    try {
      await deletePet.mutateAsync(id)
    } catch {
      setError('Não foi possível remover o pet. Tente novamente.')
    }
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <PageIntro
            eyebrow="Área da instituição"
            title="Meus pets"
            description="Cadastre, revise e mantenha atualizadas as informações dos animais disponíveis para adoção."
          />
          <LinkButton to="/organizacao/pets/novo">
            <Plus size={18} /> Cadastrar pet
          </LinkButton>
        </div>
        {error && <Alert>{error}</Alert>}
        {!petsQuery.data.length ? (
          <EmptyState
            title="Nenhum pet cadastrado"
            description="Cadastre o primeiro pet para começar a receber solicitações."
          >
            <LinkButton to="/organizacao/pets/novo">Cadastrar pet</LinkButton>
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {petsQuery.data.map((pet) => (
              <Card as="article" key={pet.id} className="overflow-hidden">
                <img src={pet.image} alt={pet.name} className="h-52 w-full object-cover" />
                <div className="p-5">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-coral">
                    {pet.species} · {pet.size}
                  </p>
                  <h2 className="mb-2 text-2xl">{pet.name}</h2>
                  <p className="min-h-10 text-xs leading-5 text-muted">{pet.summary}</p>
                  <div className="mt-4 flex gap-2">
                    <LinkButton
                      to={`/organizacao/pets/${pet.id}/editar`}
                      variant="secondary"
                      size="sm"
                    >
                      <Edit3 size={16} /> Editar
                    </LinkButton>
                    <Button
                      variant="text-danger"
                      size="sm"
                      loading={deletePet.isPending && deletePet.variables === pet.id}
                      onClick={() => remove(pet.id, pet.name)}
                    >
                      <Trash2 size={16} /> Remover
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
