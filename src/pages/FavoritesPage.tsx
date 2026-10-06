import { Heart } from 'lucide-react'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { PetGrid } from '../components/PetGrid'
import { Button, Container, EmptyState, LinkButton, PageIntro, PageSurface } from '../components/ui'
import { useFavoritePets } from '../hooks/useFavorites'

export function FavoritesPage() {
  const favoritesQuery = useFavoritePets()

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <PageIntro
          eyebrow="Seus preferidos"
          title="Favoritos"
          description="Os pets que chamaram sua atenção ficam guardados aqui."
        />
        {favoritesQuery.isPending ? (
          <PetGrid aria-label="Carregando favoritos">
            {Array.from({ length: 3 }, (_, index) => (
              <PetCardSkeleton key={index} />
            ))}
          </PetGrid>
        ) : favoritesQuery.isError ? (
          <EmptyState
            title="Não foi possível carregar seus favoritos"
            description="Verifique sua conexão e tente novamente."
            role="alert"
          >
            <Button onClick={() => void favoritesQuery.refetch()}>Tentar novamente</Button>
          </EmptyState>
        ) : favoritesQuery.data.length ? (
          <PetGrid>
            {favoritesQuery.data.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </PetGrid>
        ) : (
          <EmptyState
            icon={<Heart size={36} />}
            title="Você ainda não favoritou nenhum pet"
            description="Toque no coração de um pet para guardá-lo aqui."
          >
            <LinkButton to="/pets">Encontrar um pet</LinkButton>
          </EmptyState>
        )}
      </Container>
    </PageSurface>
  )
}
