import { Heart } from 'lucide-react'
import { Button, EmptyState, LinkButton, PageIntro } from '../components/ui'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { useFavoritePets } from '../hooks/useFavorites'

export function FavoritesPage() {
  const favoritesQuery = useFavoritePets()

  return (
    <div className="page-surface">
      <section className="container page-section">
        <PageIntro
          eyebrow="Seus preferidos"
          title="Favoritos"
          description="Os pets que chamaram sua atenção ficam guardados aqui."
        />
        {favoritesQuery.isPending ? (
          <div className="pet-grid" role="status" aria-label="Carregando favoritos">
            {Array.from({ length: 3 }, (_, index) => (
              <PetCardSkeleton key={index} />
            ))}
          </div>
        ) : favoritesQuery.isError ? (
          <EmptyState
            title="Não foi possível carregar seus favoritos"
            description="Verifique sua conexão com a API simulada e tente novamente."
            role="alert"
          >
            <Button onClick={() => void favoritesQuery.refetch()}>Tentar novamente</Button>
          </EmptyState>
        ) : favoritesQuery.data.length ? (
          <div className="pet-grid">
            {favoritesQuery.data.map((pet) => (
              <PetCard key={pet.id} pet={pet} headingLevel="h2" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Heart size={36} />}
            title="Você ainda não favoritou nenhum pet"
            description="Toque no coração de um pet para guardá-lo aqui."
          >
            <LinkButton to="/pets">Encontrar um pet</LinkButton>
          </EmptyState>
        )}
      </section>
    </div>
  )
}
