import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  HeartHandshake,
  House,
  PawPrint,
  type LucideIcon,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from 'lucide-react'
import { useMemo } from 'react'
import { PetCard, PetCardSkeleton } from '../components/PetCard'
import { PetGrid } from '../components/PetGrid'
import { Button, Card, Container, Eyebrow, LinkButton, TextLink } from '../components/ui'
import { useAdopterProfile } from '../hooks/useAdopterProfile'
import { useDemoAccount } from '../hooks/useDemoAccount'
import { usePets } from '../hooks/usePets'
import { calculateCompatibility } from '../utils/calculateCompatibility'
import { calculateProfileCompletion } from '../utils/profileCompletion'
import { profileFieldLabels } from '../utils/profileFieldLabels'

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

const profileFieldGroups = [
  {
    title: 'Informações pessoais',
    icon: UserRoundPlus,
    fields: ['name', 'cpf', 'birthDate', 'email', 'phone', 'zipCode', 'address'],
  },
  {
    title: 'Moradia e composição',
    icon: House,
    fields: ['housing', 'hasOutdoorArea', 'hasChildren', 'hasOtherPets'],
  },
  {
    title: 'Rotina e experiência',
    icon: ClipboardCheck,
    fields: ['dailyTime', 'activityLevel', 'experience', 'acceptsSpecialCare'],
  },
  {
    title: 'Preferências de adoção',
    icon: PawPrint,
    fields: ['preferredSpecies', 'preferredSize'],
  },
]

function summarizeFields(fields: string[]) {
  const labels = fields.map((field) => profileFieldLabels[field] ?? field)
  if (labels.length <= 2) return labels.join(' e ')
  return `${labels.slice(0, 2).join(', ')} e mais ${labels.length - 2}`
}

export function HomePage() {
  const account = useDemoAccount()
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
  const profileCompletion = useMemo(
    () =>
      profileQuery.data
        ? calculateProfileCompletion('adopter', profileQuery.data.profile)
        : undefined,
    [profileQuery.data],
  )
  const missingGroups = useMemo(() => {
    const missingFields = new Set(profileCompletion?.missingFields.map(({ key }) => key) ?? [])
    return profileFieldGroups
      .map((group) => ({
        ...group,
        missingFields: group.fields.filter((field) => missingFields.has(field)),
      }))
      .filter((group) => group.missingFields.length > 0)
  }, [profileCompletion])
  const profilePath = account.isAuthenticated ? account.profilePath : '/cadastro'

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
              <LinkButton variant="secondary" to={profilePath} className="w-full sm:w-auto">
                {account.isAuthenticated ? 'Completar meu perfil' : 'Criar minha conta'}
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
            <Eyebrow>{account.isAuthenticated ? 'Compatibilidade' : 'Comece por aqui'}</Eyebrow>
            <h2 className={sectionTitle}>
              {account.isAuthenticated ? 'Recomendados para você' : 'Encontre seu novo companheiro'}
            </h2>
          </div>

          {!account.isAuthenticated && (
            <Card className="relative overflow-hidden border-forest-800/10 bg-[linear-gradient(135deg,#f7f3e8_0%,#edf3eb_100%)] p-6 shadow-[0_18px_55px_rgba(29,64,49,0.08)] sm:p-8 lg:p-10">
              <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-coral/10" />
              <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
                <div>
                  <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-coral text-white shadow-[0_10px_25px_rgba(233,120,82,0.25)]">
                    <HeartHandshake size={28} />
                  </span>
                  <h3 className="mb-3 max-w-[620px] font-display text-[28px] leading-tight text-forest-900 sm:text-[34px]">
                    Crie seu perfil e descubra os pets que combinam com a sua rotina
                  </h3>
                  <p className="mb-0 max-w-[650px] text-base leading-[1.7] text-muted sm:text-lg">
                    É rápido, gratuito e ajuda a tornar cada adoção mais segura e consciente para
                    você e para o pet.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <LinkButton to="/cadastro" className="w-full sm:w-auto">
                      Criar meu perfil <ArrowRight size={18} />
                    </LinkButton>
                    <LinkButton variant="secondary" to="/pets" className="w-full sm:w-auto">
                      Explorar todos os pets
                    </LinkButton>
                  </div>
                </div>
                <ul
                  className="m-0 grid list-none gap-3 p-0"
                  aria-label="Vantagens de criar um perfil"
                >
                  {[
                    'Recomendações que combinam com você',
                    'Teste de compatibilidade personalizado',
                    'Acompanhamento das suas solicitações',
                  ].map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 px-4 py-3.5 font-semibold text-forest-800 shadow-sm"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-100 text-forest-700">
                        <CheckCircle2 size={18} />
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {account.isAuthenticated && profileQuery.isPending && (
            <Card className="animate-pulse p-6 sm:p-8" aria-label="Carregando perfil">
              <div className="mb-4 h-7 w-2/3 rounded bg-[#e5ebe6]" />
              <div className="mb-7 h-4 w-full max-w-xl rounded bg-[#e5ebe6]" />
              <div className="h-3 w-full rounded-full bg-[#e5ebe6]" />
            </Card>
          )}

          {account.isAuthenticated && profileQuery.isError && (
            <Card className="p-6 text-center sm:p-8" role="alert">
              <h3 className="mb-2 text-xl">Não foi possível verificar seu perfil</h3>
              <p className="mb-5 text-muted">
                Tente novamente para receber recomendações personalizadas.
              </p>
              <Button variant="secondary" onClick={() => void profileQuery.refetch()}>
                Tentar novamente
              </Button>
            </Card>
          )}

          {account.isAuthenticated && profileCompletion && !profileCompletion.isComplete && (
            <Card className="overflow-hidden border-forest-800/10 shadow-[0_18px_55px_rgba(29,64,49,0.07)]">
              <div className="bg-[linear-gradient(135deg,#fbf8ef_0%,#f0f5f1_100%)] p-6 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-forest-700 shadow-sm">
                      <Sparkles size={16} /> Seu perfil está quase lá
                    </span>
                    <h3 className="mb-2 font-display text-[27px] leading-tight sm:text-[31px]">
                      Complete algumas informações para liberar suas recomendações
                    </h3>
                    <p className="mb-0 max-w-[680px] leading-[1.65] text-muted">
                      Esses dados ajudam a encontrar pets compatíveis com sua casa, sua rotina e
                      suas preferências.
                    </p>
                  </div>
                  <strong className="shrink-0 font-display text-[34px] text-coral">
                    {profileCompletion.percentage}%
                  </strong>
                </div>
                <div
                  className="mt-6 h-2.5 overflow-hidden rounded-full bg-white"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-coral transition-[width] duration-300"
                    style={{ width: `${profileCompletion.percentage}%` }}
                  />
                </div>
                <span className="sr-only">Perfil {profileCompletion.percentage}% completo</span>
              </div>

              <div className="p-6 sm:p-8">
                <p className="mb-4 font-bold text-forest-900">O que ainda falta preencher</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {missingGroups.map(({ title, icon: Icon, missingFields }) => (
                    <div
                      key={title}
                      className="flex items-start gap-3 rounded-2xl border border-line bg-cream/45 p-4"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest-100 text-forest-700">
                        <Icon size={20} />
                      </span>
                      <span>
                        <strong className="block text-forest-900">{title}</strong>
                        <span className="mt-1 block text-sm leading-relaxed text-muted">
                          {summarizeFields(missingFields)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <LinkButton to={account.profilePath} className="mt-6 w-full sm:w-auto">
                  Continuar preenchimento <ArrowRight size={18} />
                </LinkButton>
              </div>
            </Card>
          )}

          {account.isAuthenticated && profileCompletion?.isComplete && (
            <PetGrid>
              {recommendedPets.map(({ pet, result }) => (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  compatibilityScore={result.score}
                  compatibilityLevel={result.level}
                />
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
          <LinkButton variant="cream" to={profilePath} className="shrink-0">
            {account.isAuthenticated ? 'Preencher meu perfil' : 'Criar meu perfil'}{' '}
            <ArrowRight size={18} />
          </LinkButton>
        </section>
      </Container>
    </>
  )
}
