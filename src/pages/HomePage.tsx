import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  type LucideIcon,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useMemo } from 'react'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { PetGrid } from '../components/PetGrid'
import { Button, Card, Container, Eyebrow, LinkButton, TextLink } from '../components/ui'
import { useAdopterProfile } from '../hooks/useAdopterProfile'
import { usePets } from '../hooks/usePets'
import { calculateCompatibility } from '../utils/calculateCompatibility'

const sectionTitle = 'mb-0 text-[clamp(34px,4vw,48px)] leading-[1.14]'
const floatingNote =
  'absolute z-[3] flex items-center gap-2.5 rounded-[14px] bg-white p-2.5 text-[10px] text-forest-800 shadow-[0_12px_35px_rgba(29,64,49,0.15)] sm:px-[15px] sm:py-3 sm:text-xs [&>span]:flex [&>span]:flex-col'

const steps: [LucideIcon, string, string, string][] = [
  [
    Search,
    '01',
    'Explore com calma',
    'Use filtros para encontrar pets que fazem sentido para sua rotina.',
  ],
  [
    Sparkles,
    '02',
    'Veja a compatibilidade',
    'Comparamos seu perfil com as necessidades de cada animal.',
  ],
  [
    HeartHandshake,
    '03',
    'Comece uma história',
    'Responda ao questionário e envie sua solicitação à organização.',
  ],
]

export function HomePage() {
  const petsQuery = usePets({ sort: 'recent', limit: 12 })
  const profileQuery = useAdopterProfile()
  const pets = useMemo(() => petsQuery.data?.pages[0]?.data ?? [], [petsQuery.data])
  const heroPet = pets[0]
  const recommendedPets = useMemo(() => {
    if (!profileQuery.data?.isComplete) {
      return []
    }

    return [...pets]
      .map((pet) => ({
        pet,
        result: calculateCompatibility(pet, profileQuery.data.profile),
      }))
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 3)
  }, [pets, profileQuery.data])

  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_20%,rgba(233,120,82,0.12),transparent_25%),linear-gradient(135deg,#fbf8ef_0%,#edf3eb_100%)] pb-[62px] pt-[54px] before:absolute before:-bottom-[140px] before:-left-[150px] before:size-[280px] before:rounded-[48%_52%_64%_36%] before:border before:border-forest-800/[0.08] before:content-[''] md:pb-[90px] md:pt-[72px]">
        <Container className="grid grid-cols-1 items-center gap-[30px] md:grid-cols-2 lg:grid-cols-[1.03fr_0.97fr] lg:gap-[72px]">
          <div>
            <Eyebrow>
              <Sparkles size={15} /> Adoção responsável
            </Eyebrow>
            <h1 className="mb-6 max-w-[660px] text-[41px] leading-[1.02] sm:text-5xl lg:text-[clamp(48px,5.3vw,76px)]">
              Encontre um amor que <em className="italic text-coral">combina</em> com a sua vida.
            </h1>
            <p className="max-w-[580px] text-lg leading-[1.7] text-muted">
              Conheça pets, entenda suas necessidades e descubra a compatibilidade antes de dar o
              próximo passo.
            </p>
            <div className="mt-[34px] flex flex-wrap gap-3">
              <LinkButton to="/pets" className="w-full sm:w-auto">
                Encontrar meu pet <ArrowRight size={18} />
              </LinkButton>
              <LinkButton variant="secondary" to="/perfil" className="w-full sm:w-auto">
                Completar meu perfil
              </LinkButton>
            </div>
            <div className="mt-[30px] flex flex-col gap-[9px] text-[13px] font-semibold text-forest-700 sm:flex-row sm:gap-6">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={17} /> ONGs verificadas
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={17} /> Processo responsável
              </span>
            </div>
          </div>
          <div
            className="relative min-h-[410px] sm:min-h-[480px] md:min-h-[440px] lg:min-h-[515px]"
            aria-label={
              heroPet ? `${heroPet.name}, pet disponível para adoção` : 'Pet disponível para adoção'
            }
          >
            <div className="absolute inset-y-0 left-2.5 right-2.5 overflow-hidden rounded-[45%_45%_44%_44%/35%_35%_50%_50%] border-[10px] border-white/80 shadow-soft after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(transparent_50%,rgba(15,42,31,0.36))] after:content-[''] md:left-[34px] md:right-6">
              {heroPet ? (
                <img
                  src={heroPet.image}
                  alt={`${heroPet.name}, pet disponível para adoção`}
                  width={560}
                  height={620}
                  className="size-full object-cover"
                />
              ) : (
                <div className="size-full animate-pulse bg-[#e5ebe6]" />
              )}
            </div>
            <div className={`${floatingNote} -left-0.5 bottom-[82px] md:left-0`}>
              <HeartHandshake size={18} />
              <span>
                <strong>+1.200</strong> encontros felizes
              </span>
            </div>
            <div className={`${floatingNote} -right-0.5 top-[82px] md:right-0`}>
              <ShieldCheck size={18} />
              <span>Cuidados verificados</span>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-white py-[68px] md:py-[92px]">
        <Container>
          <div className="mx-auto mb-12 max-w-[690px] text-center">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className={sectionTitle}>Um caminho simples para uma decisão consciente</h2>
          </div>
          <div className="grid gap-[22px] md:grid-cols-3">
            {steps.map(([Icon, number, title, text]) => (
              <Card as="article" className="relative p-[30px]" key={number}>
                <span className="absolute right-6 top-[22px] font-display text-[32px] font-bold text-[#d8e2dc]">
                  {number}
                </span>
                <span className="grid size-[46px] place-items-center rounded-[14px] bg-coral-pale text-coral">
                  <Icon />
                </span>
                <h3 className="mb-2.5 mt-[22px] font-display text-[23px]">{title}</h3>
                <p className="mb-0 leading-[1.65] text-muted">{text}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-[68px] md:py-[92px]">
        <Container>
          <div className="mb-9">
            <Eyebrow>Compatibilidade</Eyebrow>
            <h2 className={sectionTitle}>Recomendados para você</h2>
          </div>

          {!profileQuery.isPending && !profileQuery.data?.isComplete && (
            <Card className="p-6">
              <h3 className="mb-3 text-xl">Complete seu perfil para receber recomendações</h3>
              <p className="text-muted">Ainda faltam algumas informações importantes:</p>
              <ul className="mb-5 mt-3 list-disc pl-5">
                {profileQuery.data?.missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
              <LinkButton to="/perfil">Completar perfil</LinkButton>
            </Card>
          )}

          {profileQuery.data?.isComplete && (
            <PetGrid>
              {recommendedPets.map(({ pet }) => (
                <PetCard key={pet.id} pet={pet} />
              ))}
            </PetGrid>
          )}
        </Container>
      </section>

      <section className="bg-cream py-[68px] md:py-[92px]">
        <Container>
          <div className="mb-9 flex flex-col items-start gap-[30px] md:flex-row md:items-end md:justify-between">
            <div>
              <Eyebrow>Novos amigos</Eyebrow>
              <h2 className={sectionTitle}>Esperando por uma família</h2>
            </div>
            <TextLink to="/pets">
              Ver todos os pets <ArrowRight size={17} />
            </TextLink>
          </div>
          {petsQuery.isPending ? (
            <PetGrid className="max-md:[&>*:nth-child(3)]:hidden">
              {Array.from({ length: 3 }, (_, index) => (
                <PetCardSkeleton key={index} />
              ))}
            </PetGrid>
          ) : petsQuery.isError ? (
            <div
              className="rounded-[18px] border border-dashed border-line bg-white px-5 py-[34px] text-center text-muted"
              role="alert"
            >
              <p>Não foi possível carregar os novos amigos.</p>
              <Button variant="secondary" onClick={() => void petsQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : pets.length ? (
            <PetGrid className="max-md:[&>*:nth-child(3)]:hidden">
              {pets.slice(0, 3).map((pet) => (
                <PetCard key={pet.id} pet={pet} />
              ))}
            </PetGrid>
          ) : (
            <div className="rounded-[18px] border border-dashed border-line bg-white px-5 py-[34px] text-center text-muted">
              <p>Nenhum novo pet disponível no momento.</p>
            </div>
          )}
        </Container>
      </section>

      <Container className="my-[55px] md:my-[90px]">
        <section className="relative flex min-h-[225px] flex-col items-start justify-between gap-[50px] overflow-hidden rounded-[28px] bg-forest-800 px-7 py-[35px] text-white after:absolute after:-bottom-[85px] after:right-[26%] after:rotate-[-10deg] after:text-[190px] after:text-white/[0.035] after:content-['♥'] md:flex-row md:items-center md:px-[54px] md:py-[46px]">
          <div>
            <Eyebrow light>Seu perfil faz a diferença</Eyebrow>
            <h2 className="mb-0 max-w-[720px] text-[35px] leading-[1.14] text-white md:text-[clamp(34px,4vw,48px)]">
              Quanto mais sabemos sobre sua rotina, melhor fica o encontro.
            </h2>
          </div>
          <LinkButton variant="cream" to="/perfil" className="shrink-0">
            Preencher meu perfil <ArrowRight size={18} />
          </LinkButton>
        </section>
      </Container>
    </>
  )
}
