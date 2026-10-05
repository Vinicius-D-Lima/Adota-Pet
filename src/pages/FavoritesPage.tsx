import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { PageIntro } from '../components/UI'
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
          <div className="empty-state" role="alert">
            <h2>Não foi possível carregar seus favoritos</h2>
            <p>Verifique sua conexão com a API simulada e tente novamente.</p>
            <button className="button primary" onClick={() => void favoritesQuery.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : favoritesQuery.data.length ? (
          <div className="pet-grid">
            {favoritesQuery.data.map((pet) => (
              <PetCard key={pet.id} pet={pet} headingLevel="h2" />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Heart size={36} />
            <h2>Você ainda não favoritou nenhum pet</h2>
            <p>Toque no coração de um pet para guardá-lo aqui.</p>
            <Link className="button primary" to="/pets">
              Encontrar um pet
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
