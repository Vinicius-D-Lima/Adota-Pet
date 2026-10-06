import { ArrowLeft, Check, Heart, Home, MapPin, ShieldCheck, Sparkles, Syringe } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ActiveRequestNotice } from '../components/ActiveRequestNotice'
import { FlowSteps } from '../components/FlowSteps'
import { TraitList } from '../components/PetCard'
import {
  BackLink,
  Button,
  Container,
  EmptyState,
  Eyebrow,
  LinkButton,
  PageSurface,
  cx,
} from '../components/ui'
import { useActiveRequestForPet } from '../hooks/useAdoptionRequests'
import { useFavorite } from '../hooks/useFavorites'
import { usePet } from '../hooks/usePets'
import { ApiError } from '../lib/ApiError'
import { hasDemoAccount } from '../lib/demoAccount'

const pagePadding = 'pb-[90px] pt-[35px] md:pt-[54px]'

function Need({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[13px] border border-line bg-white p-4">
      <span className="grid size-[38px] place-items-center rounded-[11px] bg-forest-50 text-forest-700 [&_svg]:w-[18px]">
        {icon}
      </span>
      <span className="flex flex-col text-xs text-muted">
        <strong className="mb-[3px] text-[13px] text-ink">{title}</strong>
        {children}
      </span>
    </div>
  )
}

export function PetDetailPage() {
  const { petId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const petQuery = usePet(petId)
  const activeRequest = useActiveRequestForPet(petId)
  const { isFavorite, toggle, isPending: isFavoritePending } = useFavorite(petId ?? '')
  const backTo = (location.state as { from?: string } | null)?.from ?? '/pets'
  const handleFavorite = () => {
    if (hasDemoAccount()) toggle()
    else {
      navigate('/criar-conta', { state: { from: `${location.pathname}${location.search}` } })
    }
  }

  if (petQuery.isPending)
    return (
      <PageSurface>
        <Container
          className={cx('min-h-[620px] animate-pulse rounded-3xl bg-[#e5ebe6]', pagePadding)}
          aria-label="Carregando pet"
        />
      </PageSurface>
    )

  if (petQuery.isError) {
    const notFound = petQuery.error instanceof ApiError && petQuery.error.statusCode === 404
    return (
      <PageSurface>
        <Container as="section" className={pagePadding}>
          <EmptyState
            title={notFound ? 'Pet não encontrado' : 'Não foi possível carregar o pet'}
            headingAs="h1"
            description={
              notFound
                ? 'Este pet não está mais disponível ou o endereço está incorreto.'
                : 'Verifique sua conexão e tente novamente.'
            }
            role="alert"
          >
            {notFound ? (
              <LinkButton to="/pets">Ver outros pets</LinkButton>
            ) : (
              <Button onClick={() => void petQuery.refetch()}>Tentar novamente</Button>
            )}
          </EmptyState>
        </Container>
      </PageSurface>
    )
  }

  const pet = petQuery.data
  const petGallery = pet.gallery?.length ? pet.gallery : [pet.image]
  const gallery = [petGallery[0], petGallery[1] ?? petGallery[0], petGallery[2] ?? petGallery[0]]
  const photo = 'size-full object-cover'

  return (
    <PageSurface>
      <Container as="section" className={pagePadding}>
        <BackLink to={backTo}>
          <ArrowLeft size={17} /> Voltar para os pets
        </BackLink>
        <FlowSteps current={0} />
        <div className="grid items-start gap-11 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="grid grid-cols-2 grid-rows-[285px_120px] gap-2.5 overflow-hidden rounded-3xl md:grid-cols-[2fr_1fr] md:grid-rows-[repeat(2,205px)]">
              <img
                className={cx(photo, 'col-span-2 md:col-span-1 md:row-span-2')}
                src={gallery[0]}
                alt={`${pet.name} em destaque`}
                width={800}
                height={420}
                loading="lazy"
              />
              <img
                className={photo}
                src={gallery[1]}
                alt={`${pet.name} em outro momento`}
                width={400}
                height={205}
                loading="lazy"
              />
              <img
                className={photo}
                src={gallery[2]}
                alt={`${pet.name} brincando`}
                width={400}
                height={205}
                loading="lazy"
              />
            </div>
            <div className="px-0 pt-9 md:px-2">
              <div className="flex flex-col items-start justify-between gap-[25px] md:flex-row">
                <div>
                  <Eyebrow>Conheça {pet.name}</Eyebrow>
                  <h1 className="-mt-[5px] mb-[5px] text-[52px]">{pet.name}</h1>
                  <p className="text-muted">
                    {pet.breed} · {pet.ageLabel} · {pet.size} · {pet.sex}
                  </p>
                </div>
                <button
                  className={cx(
                    'inline-flex min-h-[42px] cursor-pointer items-center gap-[7px] rounded-[10px] border px-[13px] text-xs font-bold',
                    isFavorite
                      ? 'border-[#f1c3b3] bg-[#fff9f6] text-coral'
                      : 'border-line bg-white text-forest-800',
                  )}
                  onClick={handleFavorite}
                  aria-pressed={isFavorite}
                  aria-busy={isFavoritePending}
                >
                  <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} />{' '}
                  {isFavorite ? 'Favoritado' : 'Favoritar'}
                </button>
              </div>
              <TraitList traits={pet.traits} large />
              <section className="mt-7 border-t border-line pt-7">
                <h2 className="mb-3 text-[27px]">Minha história</h2>
                <p className="leading-[1.75] text-muted">{pet.description}</p>
              </section>
              <section className="mt-7 border-t border-line pt-7">
                <h2 className="mb-3 text-[27px]">O que eu preciso</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <Need icon={<Sparkles />} title="Nível de energia">
                    {pet.energy}
                  </Need>
                  <Need icon={<Home />} title="Espaço ideal">
                    {pet.space}
                  </Need>
                  <Need icon={<Check />} title="Convive com crianças">
                    {pet.children ? 'Sim' : 'Prefere sem crianças'}
                  </Need>
                  <Need icon={<Heart />} title="Convive com outros pets">
                    {pet.otherPets ? 'Sim' : 'Prefere ser único pet'}
                  </Need>
                  <Need icon={<Syringe />} title="Vacinação">
                    {pet.vaccinated ? 'Vacinado' : 'Não vacinado'}
                  </Need>
                  <Need icon={<ShieldCheck />} title="Castração">
                    {pet.neutered ? 'Castrado' : 'Não castrado'}
                  </Need>
                </div>
              </section>
            </div>
          </div>
          <aside className="rounded-[20px] border border-line bg-white p-6 shadow-soft lg:sticky lg:top-[102px]">
            <div className="flex items-center gap-2.5">
              <span className="grid size-[42px] place-items-center rounded-xl bg-forest-100 text-xs font-bold text-forest-800">
                {pet.organizationInitials}
              </span>
              <span className="flex flex-col">
                <small className="mb-0.5 text-[10px] text-muted">Responsável</small>
                <strong className="text-[13px]">{pet.organization}</strong>
              </span>
              <ShieldCheck size={19} className="ml-auto text-forest-700" />
            </div>
            <div className="mt-[18px] flex items-center gap-[11px] rounded-xl bg-cream p-[13px] text-forest-800">
              <MapPin size={18} />
              <span className="flex flex-col">
                <strong className="text-[13px]">{pet.city}</strong>
                {pet.distance && (
                  <small className="mb-0.5 text-[10px] text-muted">
                    A aproximadamente {pet.distance}
                  </small>
                )}
              </span>
            </div>
            <div className="my-[22px] h-px bg-line" />
            <Eyebrow>
              <Sparkles size={14} /> Próximo passo
            </Eyebrow>
            <h2 className="mb-2.5 mt-1 text-[29px]">Vocês combinam?</h2>
            <p className="text-[13px] leading-[1.6] text-muted">
              Compare sua rotina com as necessidades de {pet.name} e veja os pontos fortes desse
              encontro.
            </p>
            {activeRequest ? (
              <ActiveRequestNotice request={activeRequest} petName={pet.name} />
            ) : (
              <>
                <LinkButton fullWidth to={`/pets/${pet.id}/compatibilidade`}>
                  Ver compatibilidade <Sparkles size={18} />
                </LinkButton>
                <p className="mx-2.5 mb-0 mt-3 text-center text-[10px] text-muted">
                  O resultado é orientativo e não garante a aprovação da adoção.
                </p>
              </>
            )}
          </aside>
        </div>
      </Container>
    </PageSurface>
  )
}
