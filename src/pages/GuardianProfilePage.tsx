import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Building2, Check, Save, UserRound } from 'lucide-react'
import { useState } from 'react'
import { type Resolver, useForm, useWatch } from 'react-hook-form'
import {
  Button,
  Container,
  Feedback,
  Field,
  InfoNote,
  Input,
  PageIntro,
  PageSurface,
  SectionHeading,
  Textarea,
  cardClass,
  cx,
} from '../components/ui'
import {
  type SavedGuardianProfile,
  useGuardianProfile,
  useSaveGuardianProfile,
} from '../hooks/useGuardianProfile'
import { ApiError } from '../lib/ApiError'
import {
  type GuardianProfile,
  type GuardianProfileDraft,
  guardianProfileSchema,
} from '../schemas/guardianProfileSchema'
import { calculateProfileCompletion, guardianRequiredFields } from '../utils/profileCompletion'

const fieldLabels = Object.fromEntries(
  guardianRequiredFields.map(({ key, label }) => [key, label]),
) as Record<keyof GuardianProfileDraft, string>

const isGuardianField = (field: string): field is keyof GuardianProfileDraft => field in fieldLabels
const controlClass = 'min-h-[50px] px-4 py-3.5'

export function GuardianProfilePage({
  onSaved = () => window.scrollTo({ top: 0, behavior: 'smooth' }),
}: {
  onSaved?: () => void
}) {
  const profileQuery = useGuardianProfile()
  if (profileQuery.isPending) return <Feedback>Carregando perfil do responsável...</Feedback>
  if (profileQuery.isError)
    return <Feedback error>Não foi possível carregar o perfil do responsável.</Feedback>
  return <GuardianProfileForm savedProfile={profileQuery.data} onSaved={onSaved} />
}

function GuardianProfileForm({
  savedProfile,
  onSaved,
}: {
  savedProfile: SavedGuardianProfile
  onSaved: () => void
}) {
  const saveProfile = useSaveGuardianProfile()
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<GuardianProfileDraft, unknown, GuardianProfile>({
    resolver: zodResolver(guardianProfileSchema) as unknown as Resolver<
      GuardianProfileDraft,
      unknown,
      GuardianProfile
    >,
    defaultValues: savedProfile.profile,
  })
  const draft = useWatch({ control }) as GuardianProfileDraft
  const guardianType = useWatch({ control, name: 'guardianType' })
  const documentLabel = guardianType === 'ORGANIZATION' ? 'CNPJ' : 'CPF'
  const documentLength = guardianType === 'ORGANIZATION' ? 14 : 11

  const completion = calculateProfileCompletion('guardian', draft)
  const missingFields = completion.missingFields

  const digits = (field: 'document' | 'phone' | 'zipCode', max: number) => ({
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValue(field, event.target.value.replace(/\D/g, '').slice(0, max), { shouldDirty: true }),
  })

  const submit = handleSubmit(async (profile) => {
    setSaved(false)
    setSaveError('')
    try {
      await saveProfile.mutateAsync(profile)
      setSaved(true)
      onSaved()
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        for (const [field, message] of Object.entries(error.toFieldErrors())) {
          if (isGuardianField(field)) setError(field, { type: 'server', message })
        }
        return
      }
      setSaveError('Não foi possível salvar. Seus dados foram mantidos.')
    }
  })

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <PageIntro
          className="mb-[22px]"
          eyebrow="Perfil responsável"
          title="Quem coloca pets para adoção"
          description="Cadastre a instituição ou o protetor independente responsável pelos animais e pelas solicitações recebidas."
        />
        {saved && (
          <div
            className="mb-[18px] flex max-w-[990px] items-center gap-2 rounded-[10px] bg-forest-100 px-[15px] py-3 text-xs font-bold text-forest-700"
            role="status"
          >
            <Check size={18} /> Perfil do responsável atualizado.
          </div>
        )}
        {saveError && (
          <div
            className="mb-[18px] flex max-w-[990px] items-center gap-2 rounded-[10px] bg-coral-pale px-[15px] py-3 text-xs text-[#a33f2d]"
            role="alert"
          >
            <AlertTriangle size={18} /> {saveError}
          </div>
        )}
        <form
          className={cx(
            cardClass,
            'grid max-w-[990px] overflow-hidden md:grid-cols-[250px_minmax(0,1fr)]',
          )}
          onSubmit={submit}
          noValidate
        >
          <aside className="border-b border-line bg-cream px-6 py-8 text-left md:border-b-0 md:border-r">
            <div className="md:sticky md:top-[100px]">
              <h2 className="mb-[5px] font-sans text-xl">Acompanhe seu perfil</h2>
              <p className="mb-0 text-sm text-forest-700">
                Perfil {completion.percentage}% completo
              </p>
              <div
                className="mb-[22px] mt-3 h-[5px] overflow-hidden rounded-full bg-[#dce4de]"
                role="progressbar"
                aria-label="Completude do perfil responsável"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion.percentage}
              >
                <span
                  className="block h-full bg-coral"
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
              <div className="mb-[22px]" aria-live="polite">
                <h3 className="mb-2.5 font-sans text-sm">
                  {missingFields.length === 0
                    ? 'Perfil pronto'
                    : missingFields.length === 1
                      ? 'Falta 1 campo'
                      : `Faltam ${missingFields.length} campos`}
                </h3>
                {missingFields.length > 0 && (
                  <ul className="m-0 grid list-none gap-[7px] p-0">
                    {missingFields.map(({ key: field, label }) => (
                      <li
                        key={field}
                        className="flex items-start gap-2 text-xs leading-[1.45] text-muted before:mt-1 before:size-1.5 before:shrink-0 before:rounded-full before:border before:border-coral before:content-['']"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <InfoNote large>
                O perfil público e o cadastro de pets só serão liberados após o preenchimento das
                informações obrigatórias.
              </InfoNote>
            </div>
          </aside>

          <div className="px-[18px] py-[25px] md:p-8 [&>section+section]:mt-8 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-7">
            <section>
              <SectionHeading
                number={1}
                title="Tipo de responsável"
                description="Escolha como você realiza o trabalho de adoção."
              />
              <div className="grid gap-3 md:grid-cols-2">
                <label
                  className={cx(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-4',
                    guardianType === 'INDIVIDUAL' ? 'border-coral bg-coral-pale' : 'border-line',
                  )}
                >
                  <input
                    className="mt-1"
                    type="radio"
                    value="INDIVIDUAL"
                    {...register('guardianType')}
                  />
                  <UserRound className="shrink-0 text-forest-700" size={21} />
                  <span>
                    <strong className="block text-sm">Protetor independente</strong>
                    <small className="text-muted">Pessoa física que acolhe e encaminha pets.</small>
                  </span>
                </label>
                <label
                  className={cx(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-4',
                    guardianType === 'ORGANIZATION' ? 'border-coral bg-coral-pale' : 'border-line',
                  )}
                >
                  <input
                    className="mt-1"
                    type="radio"
                    value="ORGANIZATION"
                    {...register('guardianType')}
                  />
                  <Building2 className="shrink-0 text-forest-700" size={21} />
                  <span>
                    <strong className="block text-sm">Instituição ou ONG</strong>
                    <small className="text-muted">
                      Organização formal responsável pelas adoções.
                    </small>
                  </span>
                </label>
              </div>
              {errors.guardianType?.message && (
                <p className="mt-2 text-xs text-[#a33f2d]">{errors.guardianType.message}</p>
              )}
            </section>

            <section>
              <SectionHeading
                number={2}
                title="Identificação"
                description="Esses dados identificam quem será responsável pelos pets publicados."
              />
              <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
                {guardianType === 'ORGANIZATION' && (
                  <Field
                    label="Nome público da instituição"
                    error={errors.displayName?.message}
                    tight
                    full
                  >
                    <Input
                      className={controlClass}
                      placeholder="Ex.: Instituto Patinhas"
                      {...register('displayName')}
                    />
                  </Field>
                )}
                <Field
                  label={guardianType === 'ORGANIZATION' ? 'Razão social' : 'Nome completo'}
                  error={errors.legalName?.message}
                  tight
                >
                  <Input
                    className={controlClass}
                    autoComplete="name"
                    placeholder={
                      guardianType === 'ORGANIZATION'
                        ? 'Ex.: Instituto Patinhas de Proteção Animal'
                        : 'Ex.: Ana Maria de Souza'
                    }
                    {...register('legalName')}
                  />
                </Field>
                <Field label={documentLabel} error={errors.document?.message} tight>
                  <Input
                    className={controlClass}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={documentLength}
                    placeholder={
                      guardianType === 'ORGANIZATION' ? 'Ex.: 11222333000181' : 'Ex.: 52998224725'
                    }
                    {...register('document', digits('document', documentLength))}
                  />
                </Field>
              </div>
            </section>

            <section>
              <SectionHeading
                number={3}
                title="Contato e localização"
                description="Informações usadas no contato com adotantes e na localização dos animais."
              />
              <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
                <Field label="E-mail" error={errors.email?.message} tight>
                  <Input
                    className={controlClass}
                    type="email"
                    autoComplete="email"
                    placeholder={
                      guardianType === 'ORGANIZATION'
                        ? 'Ex.: contato@instituicao.org'
                        : 'Ex.: voce@exemplo.com'
                    }
                    {...register('email')}
                  />
                </Field>
                <Field label="Telefone/celular" error={errors.phone?.message} tight>
                  <Input
                    className={controlClass}
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    autoComplete="tel"
                    placeholder="Ex.: 11999999999"
                    {...register('phone', digits('phone', 11))}
                  />
                </Field>
                <Field label="CEP" error={errors.zipCode?.message} tight>
                  <Input
                    className={controlClass}
                    inputMode="numeric"
                    maxLength={8}
                    autoComplete="postal-code"
                    placeholder="Ex.: 01310100"
                    {...register('zipCode', digits('zipCode', 8))}
                  />
                </Field>
                <Field label="Cidade e estado" error={errors.city?.message} tight>
                  <Input
                    className={controlClass}
                    placeholder="Ex.: São Paulo, SP"
                    {...register('city')}
                  />
                </Field>
                <Field label="Endereço" error={errors.address?.message} tight full>
                  <Input
                    className={controlClass}
                    autoComplete="street-address"
                    placeholder="Ex.: Avenida Paulista, 1000 - Bela Vista"
                    {...register('address')}
                  />
                </Field>
              </div>
            </section>

            <section>
              <SectionHeading
                number={4}
                title="Apresentação"
                description="Conte aos adotantes como funciona seu trabalho com os animais."
              />
              <Field
                label="Sobre o responsável"
                error={errors.description?.message}
                hint={`${draft.description?.length ?? 0}/500 caracteres`}
                tight
                full
              >
                <Textarea
                  className="min-h-[130px]"
                  maxLength={500}
                  placeholder="Conte sua história, área de atuação e como conduz as adoções..."
                  {...register('description')}
                />
              </Field>
              <label className="mt-5 flex items-start gap-3 rounded-xl bg-forest-50 p-4 text-sm">
                <input className="mt-1" type="checkbox" {...register('acceptsTerms')} />
                <span>
                  <strong className="block">Declaro que as informações são verdadeiras</strong>
                  <small className="text-muted">
                    Também assumo a responsabilidade pelos animais e processos de adoção publicados.
                  </small>
                  {errors.acceptsTerms?.message && (
                    <small className="mt-1 block text-[#a33f2d]">
                      {errors.acceptsTerms.message}
                    </small>
                  )}
                </span>
              </label>
            </section>

            <div className="mt-[30px] flex justify-end border-t border-line pt-7">
              <Button type="submit" disabled={saveProfile.isPending}>
                <Save size={18} />{' '}
                {saveProfile.isPending ? 'Salvando…' : 'Salvar perfil responsável'}
              </Button>
            </div>
          </div>
        </form>
      </Container>
    </PageSurface>
  )
}
