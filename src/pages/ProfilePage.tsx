import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Check, Save } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import {
  type FieldErrors,
  type RegisterOptions,
  type Resolver,
  type UseFormRegister,
  useForm,
  useWatch,
} from 'react-hook-form'
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
  Select,
  cardClass,
  cx,
} from '../components/ui'
import {
  type AdopterProfile,
  useAdopterProfile,
  useSaveAdopterProfile,
} from '../hooks/useAdopterProfile'
import { ApiError } from '../lib/ApiError'
import { profileSchema } from '../schemas/profileSchema'
import type { Profile, ProfileDraft } from '../types'

const SAVE_ERROR_MESSAGE = 'Não foi possível salvar. Seus dados foram mantidos.'

const profileFieldLabels: Record<keyof ProfileDraft, string> = {
  name: 'Nome completo',
  cpf: 'CPF',
  birthDate: 'Data de nascimento',
  email: 'E-mail',
  phone: 'Telefone/celular',
  zipCode: 'CEP',
  address: 'Endereço',
  housing: 'Tipo de moradia',
  hasOutdoorArea: 'Área externa segura',
  dailyTime: 'Tempo disponível por dia',
  activityLevel: 'Nível de atividade',
  hasChildren: 'Crianças na residência',
  hasOtherPets: 'Outros pets na residência',
  experience: 'Experiência com animais',
  acceptsSpecialCare: 'Disponibilidade para cuidados especiais',
  preferredSpecies: 'Espécie desejada',
  preferredSize: 'Porte desejado',
}

const isProfileField = (field: string): field is keyof ProfileDraft => field in profileFieldLabels

const controlClass = 'min-h-[50px] px-4 py-3.5'
const selectClass = `${controlClass} pr-[42px]`

const yesNoOptions: RegisterOptions<ProfileDraft> = {
  // As opções "Sim"/"Não" viram booleanos; a opção vazia continua '' (ainda não respondido).
  // O valor inicial também passa por aqui, já como booleano.
  setValueAs: (value: unknown) =>
    typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : '',
}

type NameOf = keyof ProfileDraft

interface FormApi {
  register: UseFormRegister<ProfileDraft>
  errors: FieldErrors<ProfileDraft>
}

function ChoiceField({
  form,
  name,
  label,
  options,
}: {
  form: FormApi
  name: NameOf
  label: string
  options: string[]
}) {
  return (
    <Field label={label} error={form.errors[name]?.message as string | undefined} tight>
      <Select className={selectClass} invalid={Boolean(form.errors[name])} {...form.register(name)}>
        <option value="" disabled>
          Selecione uma opção
        </option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </Select>
    </Field>
  )
}

function YesNoField({ form, name, label }: { form: FormApi; name: NameOf; label: string }) {
  return (
    <Field label={label} error={form.errors[name]?.message as string | undefined} tight>
      <Select
        className={selectClass}
        invalid={Boolean(form.errors[name])}
        {...form.register(name, yesNoOptions)}
      >
        <option value="" disabled>
          Selecione uma opção
        </option>
        <option value="false">Não</option>
        <option value="true">Sim</option>
      </Select>
    </Field>
  )
}

function Notice({
  tone,
  children,
  ...props
}: {
  tone: 'success' | 'warning'
  children: ReactNode
  role?: 'alert' | 'status'
}) {
  return (
    <div
      className={cx(
        'mb-[18px] flex max-w-[860px] items-center gap-2 rounded-[10px] px-[15px] py-3 text-xs',
        tone === 'success'
          ? 'bg-forest-100 font-bold text-forest-700'
          : 'bg-coral-pale text-[#a33f2d]',
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function ProfilePage() {
  const profileQuery = useAdopterProfile()

  if (profileQuery.isPending) {
    return <Feedback>Carregando seu perfil...</Feedback>
  }

  if (profileQuery.isError) {
    return <Feedback error>Não foi possível carregar seu perfil. Tente novamente.</Feedback>
  }

  return <ProfileForm savedProfile={profileQuery.data} />
}

interface ProfileFormProps {
  savedProfile: AdopterProfile
}

function ProfileForm({ savedProfile }: ProfileFormProps) {
  const saveProfile = useSaveAdopterProfile()
  // Guarda para qual versão do formulário a confirmação vale: editar qualquer campo a esconde.
  const [savedFor, setSavedFor] = useState<unknown>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProfileDraft, unknown, Profile>({
    resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileDraft, unknown, Profile>,
    defaultValues: savedProfile.profile,
  })
  const draft = useWatch({ control }) as ProfileDraft
  const form: FormApi = { register, errors }

  const saved = savedFor === draft

  /** Campo numérico: aceita só dígitos e respeita o limite de tamanho. */
  const digits = <N extends 'cpf' | 'phone' | 'zipCode'>(
    name: N,
    max: number,
  ): RegisterOptions<ProfileDraft, N> => ({
    onChange: (event) =>
      // O tipo de `name` é só um dos três campos de texto; o valor é sempre uma string.
      setValue(name as 'cpf', event.target.value.replace(/\D/g, '').slice(0, max), {
        shouldDirty: true,
      }),
  })

  const submit = handleSubmit(async (profile) => {
    if (saveProfile.isPending) return
    setSavedFor(null)
    setSaveError(null)

    try {
      await saveProfile.mutateAsync(profile)
      setSavedFor(draft)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        const fieldErrors = Object.entries(error.toFieldErrors()).filter(([field]) =>
          isProfileField(field),
        )
        if (fieldErrors.length > 0) {
          for (const [field, message] of fieldErrors) {
            setError(field as NameOf, { type: 'server', message })
          }
          return
        }
      }
      setSaveError(SAVE_ERROR_MESSAGE)
    }
  })

  const profileEntries = Object.entries(profileFieldLabels) as Array<[keyof ProfileDraft, string]>
  const missingFields = profileEntries.filter(([key]) => {
    const value = draft[key]
    return typeof value !== 'boolean' && value.trim().length === 0
  })
  const completedFields = profileEntries.length - missingFields.length
  const completionPercentage = Math.round((completedFields / profileEntries.length) * 100)
  const savedMissingFields = savedProfile.missingFields.map((field) =>
    isProfileField(field) ? profileFieldLabels[field] : field,
  )

  return (
    <PageSurface>
      <Container as="section" className="pb-[90px] pt-[35px] md:pt-[54px]">
        <PageIntro
          className="mb-[22px]"
          eyebrow="Seu espaço no AdotaPet"
          title="Perfil do adotante"
          description="Essas informações são usadas para calcular sua compatibilidade e apoiar uma adoção responsável."
        />
        {saved && (
          <Notice tone="success" role="status">
            <Check size={18} /> Perfil atualizado. As próximas compatibilidades usarão estes dados.
          </Notice>
        )}
        {saveError && (
          <Notice tone="warning" role="alert">
            <AlertTriangle size={18} /> {saveError}
          </Notice>
        )}
        {!savedProfile.isComplete && (
          <Notice tone="warning" role="status">
            <AlertTriangle size={18} />
            <div className="font-medium">
              <strong>Seu perfil salvo está incompleto.</strong>
              {savedMissingFields.length > 0 && <> Complete: {savedMissingFields.join(', ')}.</>}
            </div>
          </Notice>
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
              <div>
                <h2 className="mb-[5px] font-sans text-[17px]">Acompanhe seu perfil</h2>
                <p className="mb-0 text-[11px] text-forest-700">
                  Perfil {completionPercentage}% completo
                </p>
              </div>
              <div
                className="mb-[22px] mt-3 h-[5px] overflow-hidden rounded-full bg-[#dce4de]"
                role="progressbar"
                aria-label="Completude do perfil"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completionPercentage}
              >
                <span
                  className="block h-full bg-coral"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <div className="mb-[22px]" aria-live="polite">
                {missingFields.length > 0 ? (
                  <>
                    <h3 className="mb-2.5 font-sans text-xs">
                      {missingFields.length === 1
                        ? 'Falta 1 campo'
                        : `Faltam ${missingFields.length} campos`}
                    </h3>
                    <ul className="m-0 grid list-none gap-[7px] overflow-y-auto p-0 pr-[5px] md:max-h-[calc(100vh-410px)]">
                      {missingFields.map(([key, label]) => (
                        <li
                          key={key}
                          className="flex items-start gap-2 text-[10px] leading-[1.35] text-muted before:mt-1 before:size-1.5 before:shrink-0 before:rounded-full before:border before:border-coral before:content-['']"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mb-0 text-[11px] font-bold text-forest-700">
                    Todos os campos foram preenchidos.
                  </p>
                )}
              </div>
              <InfoNote>
                <p className="mb-0">
                  Seus dados são compartilhados apenas com a organização quando você envia uma
                  solicitação.
                </p>
              </InfoNote>
            </div>
          </aside>
          <div className="px-[18px] py-[25px] md:p-8 [&>section+section]:mt-8 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-7">
            <section>
              <SectionHeading
                number={1}
                title="Informações pessoais"
                description="Dados de identificação e contato do responsável pela adoção."
              />
              <div className="grid grid-cols-1 gap-[18px]">
                <Field label="Nome completo" error={errors.name?.message} tight full>
                  <Input
                    className={controlClass}
                    invalid={Boolean(errors.name)}
                    placeholder="Digite seu nome completo"
                    autoComplete="name"
                    {...register('name')}
                  />
                </Field>
                <Field label="CPF" error={errors.cpf?.message} tight>
                  <Input
                    className={controlClass}
                    invalid={Boolean(errors.cpf)}
                    placeholder="Ex.: 52998224725"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    autoComplete="off"
                    {...register('cpf', digits('cpf', 11))}
                  />
                </Field>
                <Field
                  label="Data de nascimento"
                  error={errors.birthDate?.message}
                  hint="É necessário ter pelo menos 18 anos."
                  tight
                >
                  <Input
                    className={controlClass}
                    type="date"
                    invalid={Boolean(errors.birthDate)}
                    autoComplete="bday"
                    {...register('birthDate')}
                  />
                </Field>
                <Field label="E-mail" error={errors.email?.message} tight>
                  <Input
                    className={controlClass}
                    type="email"
                    invalid={Boolean(errors.email)}
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    {...register('email')}
                  />
                </Field>
                <Field label="Telefone/celular" error={errors.phone?.message} tight>
                  <Input
                    className={controlClass}
                    type="tel"
                    invalid={Boolean(errors.phone)}
                    placeholder="Ex.: 11999999999"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    autoComplete="tel"
                    {...register('phone', digits('phone', 11))}
                  />
                </Field>
                <Field label="CEP" error={errors.zipCode?.message} tight>
                  <Input
                    className={controlClass}
                    invalid={Boolean(errors.zipCode)}
                    placeholder="Ex.: 01001000"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    autoComplete="postal-code"
                    {...register('zipCode', digits('zipCode', 8))}
                  />
                </Field>
                <Field label="Endereço" error={errors.address?.message} tight full>
                  <Input
                    className={controlClass}
                    invalid={Boolean(errors.address)}
                    placeholder="Rua, número, bairro e cidade"
                    autoComplete="street-address"
                    {...register('address')}
                  />
                </Field>
              </div>
            </section>

            <section>
              <SectionHeading
                number={2}
                title="Moradia e composição da casa"
                description="Conte como é o ambiente onde o pet viverá."
              />
              <div className="grid grid-cols-1 gap-[18px]">
                <ChoiceField
                  form={form}
                  name="housing"
                  label="Tipo de moradia"
                  options={['Apartamento', 'Casa', 'Chácara ou sítio']}
                />
                <YesNoField form={form} name="hasOutdoorArea" label="Área externa segura?" />
                <YesNoField form={form} name="hasChildren" label="Há crianças na residência?" />
                <YesNoField form={form} name="hasOtherPets" label="Já há outros pets?" />
              </div>
            </section>

            <section>
              <SectionHeading
                number={3}
                title="Rotina e experiência"
                description="Isso nos ajuda a considerar energia, companhia e cuidados."
              />
              <div className="grid grid-cols-1 gap-[18px]">
                <ChoiceField
                  form={form}
                  name="dailyTime"
                  label="Tempo disponível por dia"
                  options={['Até 1 hora', '2 a 3 horas', 'Mais de 3 horas']}
                />
                <ChoiceField
                  form={form}
                  name="activityLevel"
                  label="Nível de atividade"
                  options={['Tranquilo', 'Moderado', 'Ativo']}
                />
                <ChoiceField
                  form={form}
                  name="experience"
                  label="Experiência com animais"
                  options={['Primeiro pet', 'Já tive pets', 'Tenho bastante experiência']}
                />
                <YesNoField
                  form={form}
                  name="acceptsSpecialCare"
                  label="Disponibilidade para cuidados especiais?"
                />
              </div>
            </section>

            <section>
              <SectionHeading
                number={4}
                title="Preferências"
                description="Preferências ajudam na busca, mas não limitam suas possibilidades."
              />
              <div className="grid grid-cols-1 gap-[18px]">
                <ChoiceField
                  form={form}
                  name="preferredSpecies"
                  label="Espécie"
                  options={['Sem preferência', 'Cachorro', 'Gato']}
                />
                <ChoiceField
                  form={form}
                  name="preferredSize"
                  label="Porte"
                  options={['Sem preferência', 'Pequeno', 'Pequeno ou médio', 'Médio ou grande']}
                />
              </div>
            </section>

            <div className="mt-[30px] flex flex-col items-stretch justify-between gap-5 border-t border-line pt-7 md:flex-row md:items-center">
              <p className="mb-0 text-[10px] text-muted">
                Alterações relevantes podem mudar os resultados de compatibilidade.
              </p>
              <Button type="submit" disabled={saveProfile.isPending}>
                <Save size={18} /> {saveProfile.isPending ? 'Salvando…' : 'Salvar perfil'}
              </Button>
            </div>
          </div>
        </form>
      </Container>
    </PageSurface>
  )
}
