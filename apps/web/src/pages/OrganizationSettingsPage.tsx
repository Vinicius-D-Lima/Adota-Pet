import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Can } from '../components/Can'
import {
  Alert,
  Button,
  Card,
  Container,
  Field,
  Feedback,
  InfoNote,
  Input,
  PageIntro,
  PageSurface,
  Textarea,
} from '../components/ui'
import {
  useActiveOrganizationId,
  useOrganizationDetails,
  useUpdateOrganization,
} from '../hooks/useOrganization'
import { ApiError } from '../lib/ApiError'

const organizationSettingsSchema = z.object({
  displayName: z.string().trim().min(3, 'Informe o nome da organização.'),
  name: z.string().trim().min(3, 'Informe a razão social.'),
  initials: z.string().trim().min(1, 'Informe as iniciais.').max(10, 'Use até 10 caracteres.'),
  cnpj: z
    .string()
    .trim()
    .refine(
      (value) => !value || value.replace(/\D/g, '').length === 14,
      'Informe um CNPJ com 14 dígitos.',
    ),
  phone: z.string().trim().min(8, 'Informe um telefone com DDD.'),
  email: z.email('Informe um e-mail válido.'),
  address: z.string().trim().min(5, 'Informe o endereço.'),
  city: z.string().trim().min(2, 'Informe a cidade.'),
  description: z.string().trim().min(20, 'Conte um pouco sobre a organização.'),
})

type SettingsForm = z.input<typeof organizationSettingsSchema>

export function OrganizationSettingsPage() {
  const organizationId = useActiveOrganizationId()
  const detailsQuery = useOrganizationDetails(organizationId)
  const updateOrganization = useUpdateOrganization()
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(organizationSettingsSchema) as Resolver<SettingsForm>,
    defaultValues: {
      displayName: '',
      name: '',
      initials: '',
      cnpj: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      description: '',
    },
  })

  useEffect(() => {
    const organization = detailsQuery.data
    if (!organization) return
    reset({
      displayName: organization.displayName ?? organization.name ?? '',
      name: organization.name ?? organization.displayName ?? '',
      initials: organization.initials ?? '',
      cnpj: organization.cnpj ?? organization.document ?? '',
      phone: organization.phone ?? '',
      email: organization.email ?? organization.contactEmail ?? '',
      address: organization.address ?? '',
      city: organization.city ?? '',
      description: organization.description ?? '',
    })
  }, [detailsQuery.data, reset])

  if (detailsQuery.isPending) return <Feedback>Carregando dados da organização...</Feedback>
  if (detailsQuery.isError || !detailsQuery.data) {
    return <Feedback error>Não foi possível carregar os dados da organização.</Feedback>
  }

  const submit = handleSubmit(async (data) => {
    setSaved(false)
    try {
      await updateOrganization.mutateAsync({
        id: organizationId,
        data: {
          displayName: data.displayName,
          name: data.name,
          initials: data.initials.toUpperCase(),
          cnpj: data.cnpj,
          document: data.cnpj,
          phone: data.phone,
          email: data.email,
          contactEmail: data.email,
          address: data.address,
          city: data.city,
          description: data.description,
        },
      })
      setSaved(true)
    } catch {
      // O Alert abaixo mostra a mensagem devolvida pela API.
    }
  })

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <PageIntro
          eyebrow="Área da organização"
          title="Dados da ONG"
          description="Mantenha as informações de contato e a apresentação da instituição atualizadas."
        />
        <Can do="update" on="Organization" organizationId={organizationId}>
          <Card className="mx-auto max-w-[760px] p-5 md:p-8">
            <form className="grid gap-x-5" onSubmit={(event) => void submit(event)} noValidate>
              <div className="grid gap-x-5 sm:grid-cols-2">
                <Field label="Nome de exibição" error={errors.displayName?.message}>
                  <Input invalid={Boolean(errors.displayName)} {...register('displayName')} />
                </Field>
                <Field label="Razão social" error={errors.name?.message}>
                  <Input invalid={Boolean(errors.name)} {...register('name')} />
                </Field>
              </div>
              <div className="grid gap-x-5 sm:grid-cols-2">
                <Field label="Iniciais" error={errors.initials?.message}>
                  <Input invalid={Boolean(errors.initials)} {...register('initials')} />
                </Field>
                <Field label="CNPJ" error={errors.cnpj?.message}>
                  <Input invalid={Boolean(errors.cnpj)} {...register('cnpj')} />
                </Field>
              </div>
              <div className="grid gap-x-5 sm:grid-cols-2">
                <Field label="Telefone" error={errors.phone?.message}>
                  <Input invalid={Boolean(errors.phone)} {...register('phone')} />
                </Field>
                <Field label="E-mail de contato" error={errors.email?.message}>
                  <Input type="email" invalid={Boolean(errors.email)} {...register('email')} />
                </Field>
              </div>
              <Field label="Endereço" error={errors.address?.message}>
                <Input invalid={Boolean(errors.address)} {...register('address')} />
              </Field>
              <Field label="Cidade" error={errors.city?.message}>
                <Input invalid={Boolean(errors.city)} {...register('city')} />
              </Field>
              <Field label="Descrição" error={errors.description?.message}>
                <Textarea
                  rows={5}
                  invalid={Boolean(errors.description)}
                  {...register('description')}
                />
              </Field>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <Button type="submit" loading={updateOrganization.isPending}>
                  <Save size={17} /> Salvar alterações
                </Button>
                {saved && <InfoNote>Alterações salvas com sucesso.</InfoNote>}
              </div>
              {updateOrganization.isError && (
                <Alert>
                  {updateOrganization.error instanceof ApiError
                    ? updateOrganization.error.message
                    : 'Não foi possível salvar as alterações.'}
                </Alert>
              )}
            </form>
          </Card>
        </Can>
      </Container>
    </PageSurface>
  )
}
