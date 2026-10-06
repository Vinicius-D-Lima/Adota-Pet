import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { type Resolver, type UseFormRegisterReturn, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  BackLink,
  Button,
  cardClass,
  Container,
  Field,
  Feedback,
  Input,
  PageSurface,
  Select,
  Textarea,
} from '../components/ui'
import { useOrganizationPets, useSaveOrganizationPet } from '../hooks/useOrganization'
import {
  organizationPetFormSchema,
  organizationPetPayloadSchema,
  type OrganizationPetFormData,
} from '../schemas/organizationSchema'

const emptyForm: OrganizationPetFormData = {
  name: '',
  species: '',
  breed: '',
  age: '',
  size: '',
  sex: '',
  city: '',
  image: '',
  summary: '',
  description: '',
  traits: '',
  energy: '',
  space: '',
  children: '',
  otherPets: '',
  specialCare: '',
  vaccinated: '',
  neutered: '',
}

export function OrganizationPetFormPage() {
  const { petId } = useParams()
  const navigate = useNavigate()
  const petsQuery = useOrganizationPets(Boolean(petId))
  const savePet = useSaveOrganizationPet()
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrganizationPetFormData>({
    resolver: zodResolver(organizationPetFormSchema) as Resolver<OrganizationPetFormData>,
    defaultValues: emptyForm,
  })
  const pet = petId ? petsQuery.data?.find((item) => item.id === petId) : undefined

  useEffect(() => {
    if (!pet) return
    reset({
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: String(pet.age),
      size: pet.size,
      sex: pet.sex,
      city: pet.city,
      image: pet.image,
      summary: pet.summary,
      description: pet.description,
      traits: pet.traits.join(', '),
      energy: pet.energy,
      space: pet.space,
      children: String(pet.children),
      otherPets: String(pet.otherPets),
      specialCare: String(pet.specialCare),
      vaccinated: String(pet.vaccinated),
      neutered: String(pet.neutered),
    })
  }, [pet, reset])

  if (petId && petsQuery.isPending) return <Feedback>Carregando cadastro...</Feedback>
  if (petId && (petsQuery.isError || !pet))
    return <Feedback error>Pet não encontrado entre os cadastros da instituição.</Feedback>

  const submit = handleSubmit(async (data) => {
    setSubmitError('')
    try {
      await savePet.mutateAsync({ id: petId, data: organizationPetPayloadSchema.parse(data) })
      navigate('/organizacao/pets', { replace: true })
    } catch {
      setSubmitError('Não foi possível salvar o pet. Revise os dados e tente novamente.')
    }
  })

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-9 md:pt-12">
        <BackLink to="/organizacao/pets">Voltar para meus pets</BackLink>
        <form
          className={`${cardClass} mx-auto mt-5 max-w-[920px] p-6 md:p-9`}
          onSubmit={submit}
          noValidate
        >
          <p className="mb-1 text-xs font-bold uppercase tracking-[.12em] text-coral">
            Área da instituição
          </p>
          <h1 className="mb-2 text-3xl md:text-4xl">
            {petId ? `Editar ${pet?.name}` : 'Cadastrar pet'}
          </h1>
          <p className="mb-7 text-sm text-muted">
            As informações serão exibidas para as pessoas que estiverem buscando um pet.
          </p>
          {submitError && <Alert>{submitError}</Alert>}
          <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
            <FormField label="Nome" error={errors.name?.message}>
              <Input placeholder="Ex.: Mel" invalid={Boolean(errors.name)} {...register('name')} />
            </FormField>
            <FormField label="Raça" error={errors.breed?.message}>
              <Input
                placeholder="Ex.: SRD"
                invalid={Boolean(errors.breed)}
                {...register('breed')}
              />
            </FormField>
            <Choice
              label="Espécie"
              error={errors.species?.message}
              register={register('species')}
              options={['Cachorro', 'Gato'].map((value) => ({ value, label: value }))}
            />
            <Choice
              label="Sexo"
              error={errors.sex?.message}
              register={register('sex')}
              options={['Fêmea', 'Macho'].map((value) => ({ value, label: value }))}
            />
            <FormField label="Idade em anos" error={errors.age?.message}>
              <Input
                type="number"
                min="0"
                max="30"
                placeholder="Ex.: 2"
                invalid={Boolean(errors.age)}
                {...register('age')}
              />
            </FormField>
            <Choice
              label="Porte"
              error={errors.size?.message}
              register={register('size')}
              options={['Pequeno', 'Médio', 'Grande'].map((value) => ({ value, label: value }))}
            />
            <FormField label="Cidade e estado" error={errors.city?.message}>
              <Input
                placeholder="Ex.: São Paulo, SP"
                invalid={Boolean(errors.city)}
                {...register('city')}
              />
            </FormField>
            <Choice
              label="Nível de energia"
              error={errors.energy?.message}
              register={register('energy')}
              options={['Baixa', 'Média', 'Alta'].map((value) => ({ value, label: value }))}
            />
            <FormField label="URL da foto principal" error={errors.image?.message} full>
              <Input
                type="url"
                placeholder="https://..."
                invalid={Boolean(errors.image)}
                {...register('image')}
              />
            </FormField>
            <FormField label="Resumo" error={errors.summary?.message} full>
              <Input
                placeholder="Uma frase curta sobre o pet"
                invalid={Boolean(errors.summary)}
                {...register('summary')}
              />
            </FormField>
            <FormField label="Descrição" error={errors.description?.message} full>
              <Textarea
                rows={5}
                placeholder="Conte a história, o comportamento e a rotina do pet."
                invalid={Boolean(errors.description)}
                {...register('description')}
              />
            </FormField>
            <FormField label="Características" error={errors.traits?.message} full>
              <Input
                placeholder="Carinhoso, brincalhão, tranquilo"
                invalid={Boolean(errors.traits)}
                {...register('traits')}
              />
            </FormField>
            <FormField label="Espaço recomendado" error={errors.space?.message} full>
              <Input
                placeholder="Ex.: Apartamento telado ou casa"
                invalid={Boolean(errors.space)}
                {...register('space')}
              />
            </FormField>
            <BooleanChoice
              label="Convive com crianças?"
              error={errors.children?.message}
              register={register('children')}
            />
            <BooleanChoice
              label="Convive com outros pets?"
              error={errors.otherPets?.message}
              register={register('otherPets')}
            />
            <BooleanChoice
              label="Exige cuidados especiais?"
              error={errors.specialCare?.message}
              register={register('specialCare')}
            />
            <BooleanChoice
              label="Está vacinado?"
              error={errors.vaccinated?.message}
              register={register('vaccinated')}
            />
            <BooleanChoice
              label="Está castrado?"
              error={errors.neutered?.message}
              register={register('neutered')}
            />
          </div>
          <div className="mt-7 flex justify-end">
            <Button type="submit" loading={savePet.isPending}>
              <Save size={18} /> Salvar pet
            </Button>
          </div>
        </form>
      </Container>
    </PageSurface>
  )
}

function FormField({
  label,
  error,
  full,
  children,
}: {
  label: string
  error?: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <Field label={label} error={error} full={full} tight>
      {children}
    </Field>
  )
}
function Choice({
  label,
  error,
  register,
  options,
}: {
  label: string
  error?: string
  register: UseFormRegisterReturn
  options: { value: string; label: string }[]
}) {
  return (
    <Field label={label} error={error} tight>
      <Select invalid={Boolean(error)} {...register}>
        <option value="">Selecione</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}
function BooleanChoice({
  label,
  error,
  register,
}: {
  label: string
  error?: string
  register: UseFormRegisterReturn
}) {
  return (
    <Choice
      label={label}
      error={error}
      register={register}
      options={[
        { value: 'true', label: 'Sim' },
        { value: 'false', label: 'Não' },
      ]}
    />
  )
}
