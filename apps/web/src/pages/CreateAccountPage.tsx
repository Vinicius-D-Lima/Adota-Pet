import { zodResolver } from '@hookform/resolvers/zod'
import { type Resolver, useForm, useWatch } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { PawPrint, UserRoundPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { createAccountSchema } from '@adotapet/shared'
import { Alert, Button, Card, Container, Field, Input, PageSurface } from '../components/ui'
import { adopterProfileKey } from '../hooks/useAdopterProfile'
import { guardianProfileKey } from '../hooks/useGuardianProfile'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { register } from '../lib/auth'
import { createDemoAccount } from '../lib/demoAccount'
import { isRealAuth, updateUser, type AuthUser } from '../lib/session'

/** A confirmação existe só no formulário: o contrato da API não a recebe. */
const registerFormSchema = createAccountSchema.and(
  z.object({ confirmPassword: z.string().min(1, 'Confirme sua senha.') }),
)
type RegisterFormData = z.infer<typeof registerFormSchema>

export function CreateAccountPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [accountError, setAccountError] = useState('')
  const {
    register: registerField,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema) as Resolver<RegisterFormData>,
    defaultValues: {
      accountType: 'adopter',
      name: '',
      cpf: '',
      birthDate: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      organizationName: '',
      responsibleName: '',
      document: '',
      city: '',
      state: '',
      zipCode: '',
      address: '',
    },
  })
  const accountType = useWatch({ control, name: 'accountType' })
  const guardianType = useWatch({ control, name: 'guardianType' })

  useEffect(() => {
    if (!guardianType) return
    setValue('document', '', { shouldDirty: false, shouldValidate: false })
    if (guardianType === 'INDIVIDUAL') {
      setValue('organizationName', '', { shouldDirty: false, shouldValidate: false })
    }
  }, [guardianType, setValue])

  const digits = (field: 'cpf' | 'phone' | 'document' | 'zipCode', max: number) => ({
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValue(field, event.target.value.replace(/\D/g, '').slice(0, max), {
        shouldDirty: true,
        shouldValidate: false,
      }),
  })

  const submit = handleSubmit(async (data) => {
    setAccountError('')
    clearErrors('confirmPassword')
    if (data.password !== data.confirmPassword) {
      setError('confirmPassword', { message: 'As senhas não coincidem.' })
      return
    }
    const { accountType } = data
    const profilePath = accountType === 'guardian' ? '/perfil?tipo=responsavel' : '/perfil'
    const personalData =
      accountType === 'guardian'
        ? {
            guardianType: data.guardianType,
            ...(data.guardianType === 'ORGANIZATION'
              ? { organizationName: data.organizationName }
              : {}),
            responsibleName: data.responsibleName,
            document: data.document,
            email: data.email,
            phone: data.phone,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            address: data.address,
          }
        : {
            name: data.name,
            cpf: data.cpf,
            birthDate: data.birthDate,
            email: data.email,
            phone: data.phone,
            zipCode: data.zipCode,
            address: data.address,
          }
    try {
      const accountPayload =
        accountType === 'guardian'
          ? {
              accountType,
              guardianType: data.guardianType,
              ...(data.guardianType === 'ORGANIZATION'
                ? { organizationName: data.organizationName }
                : {}),
              responsibleName: data.responsibleName,
              document: data.document,
              city: data.city,
              state: data.state,
              zipCode: data.zipCode,
              address: data.address,
              email: data.email,
              phone: data.phone,
              password: data.password,
            }
          : {
              accountType,
              name: data.name,
              cpf: data.cpf,
              birthDate: data.birthDate,
              email: data.email,
              phone: data.phone,
              zipCode: data.zipCode,
              address: data.address,
              password: data.password,
            }
      if (isRealAuth()) {
        // O cadastro real cria o usuário e devolve tokens; o perfil é salvo em seguida.
        const name = accountType === 'guardian' ? data.responsibleName : data.name
        await register({ name: name ?? '', email: data.email, password: data.password })
      }

      const saved = await api.put<AuthUser>('/me/account', accountPayload)
      if (isRealAuth() && saved) updateUser(saved)
      if (!isRealAuth()) createDemoAccount(profilePath, personalData)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adopterProfileKey }),
        queryClient.invalidateQueries({ queryKey: guardianProfileKey }),
      ])
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 409) {
          setError('email', { message: 'Já existe uma conta com este e-mail' })
          return
        }
        const fieldErrors = error.toFieldErrors()
        let fieldErrorShown = false
        for (const [field, message] of Object.entries(fieldErrors)) {
          if (!(field in data)) continue
          setError(field as keyof RegisterFormData, { message })
          fieldErrorShown = true
        }
        if (fieldErrorShown) return
        setAccountError(error.message)
        return
      }
      setAccountError('Não foi possível criar sua conta. Tente novamente.')
    }
  })

  return (
    <PageSurface>
      <Container as="section" className="py-10 md:py-16">
        <Card className="mx-auto max-w-[820px] p-6 md:p-10">
          <div className="mb-7 flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-forest-100 text-forest-800">
              <UserRoundPlus size={24} />
            </span>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-coral">
                Faça parte do AdotaPet
              </p>
              <h1 className="mb-2 text-[34px] md:text-[42px]">Crie sua conta</h1>
              <p className="m-0 text-sm leading-6 text-muted">
                Escolha o tipo de conta. Mostraremos apenas os dados necessários para começar.
              </p>
            </div>
          </div>

          {accountError && <Alert>{accountError}</Alert>}
          <form className="grid gap-5" onSubmit={submit} noValidate>
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-xs font-bold">Como você quer usar o AdotaPet?</legend>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4">
                  <input type="radio" value="adopter" {...registerField('accountType')} />
                  <span>
                    <strong className="block text-sm">Quero adotar</strong>
                    <small className="text-muted">Encontre e favorite pets para conhecer.</small>
                  </span>
                </label>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4">
                  <input type="radio" value="guardian" {...registerField('accountType')} />
                  <span>
                    <strong className="block text-sm">Quero divulgar pets</strong>
                    <small className="text-muted">
                      Para instituições e protetores independentes.
                    </small>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="mt-2 border-t border-line pt-6">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-coral">
                {accountType === 'guardian' ? 'Dados do responsável' : 'Dados básicos'}
              </p>
              <h2 className="mb-1 text-[27px]">
                {accountType === 'guardian'
                  ? 'Informações de quem divulga os pets'
                  : 'Informações do adotante'}
              </h2>
              <p className="mb-5 text-xs leading-5 text-muted">
                {accountType === 'guardian'
                  ? 'Escolha se o responsável é uma pessoa física ou uma instituição.'
                  : 'Esses dados pessoais serão levados automaticamente para o seu perfil.'}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {accountType === 'adopter' ? (
                <>
                  <Field label="Nome completo" error={errors.name?.message} tight>
                    <Input
                      autoComplete="name"
                      placeholder="Ex.: Maria da Silva"
                      invalid={Boolean(errors.name)}
                      {...registerField('name')}
                    />
                  </Field>
                  <Field label="Data de nascimento" error={errors.birthDate?.message} tight>
                    <Input
                      type="date"
                      autoComplete="bday"
                      invalid={Boolean(errors.birthDate)}
                      {...registerField('birthDate')}
                    />
                  </Field>
                  <Field label="CPF" error={errors.cpf?.message} tight>
                    <Input
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="Ex.: 52998224725"
                      invalid={Boolean(errors.cpf)}
                      {...registerField('cpf', digits('cpf', 11))}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <fieldset className="col-span-full grid gap-3">
                    <legend className="text-xs font-bold">Tipo de responsável</legend>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4">
                        <input type="radio" value="INDIVIDUAL" {...registerField('guardianType')} />
                        <span>
                          <strong className="block text-sm">Pessoa física</strong>
                          <small className="text-muted">Protetor independente com CPF.</small>
                        </span>
                      </label>
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4">
                        <input
                          type="radio"
                          value="ORGANIZATION"
                          {...registerField('guardianType')}
                        />
                        <span>
                          <strong className="block text-sm">Instituição ou ONG</strong>
                          <small className="text-muted">Pessoa jurídica com CNPJ.</small>
                        </span>
                      </label>
                    </div>
                    {errors.guardianType?.message && (
                      <small className="text-[#a33f2d]">{errors.guardianType.message}</small>
                    )}
                  </fieldset>
                  {guardianType && (
                    <>
                      {guardianType === 'ORGANIZATION' && (
                        <Field
                          label="Nome da instituição"
                          error={errors.organizationName?.message}
                          tight
                        >
                          <Input
                            placeholder="Ex.: Instituto Patinhas"
                            invalid={Boolean(errors.organizationName)}
                            {...registerField('organizationName')}
                          />
                        </Field>
                      )}
                      <Field
                        label={
                          guardianType === 'INDIVIDUAL' ? 'Nome completo' : 'Nome do responsável'
                        }
                        error={errors.responsibleName?.message}
                        tight
                      >
                        <Input
                          autoComplete="name"
                          placeholder="Ex.: Ana Maria de Souza"
                          invalid={Boolean(errors.responsibleName)}
                          {...registerField('responsibleName')}
                        />
                      </Field>
                      <Field
                        label={guardianType === 'INDIVIDUAL' ? 'CPF' : 'CNPJ'}
                        error={errors.document?.message}
                        tight
                      >
                        <Input
                          inputMode="numeric"
                          maxLength={guardianType === 'INDIVIDUAL' ? 11 : 14}
                          placeholder={
                            guardianType === 'INDIVIDUAL'
                              ? 'Ex.: 52998224725'
                              : 'Ex.: 11222333000181'
                          }
                          invalid={Boolean(errors.document)}
                          {...registerField(
                            'document',
                            digits('document', guardianType === 'INDIVIDUAL' ? 11 : 14),
                          )}
                        />
                      </Field>
                      <Field label="Cidade" error={errors.city?.message} tight>
                        <Input
                          placeholder="Ex.: São Paulo"
                          invalid={Boolean(errors.city)}
                          {...registerField('city')}
                        />
                      </Field>
                      <Field label="Estado" error={errors.state?.message} tight>
                        <Input
                          maxLength={2}
                          placeholder="Ex.: SP"
                          invalid={Boolean(errors.state)}
                          {...registerField('state')}
                        />
                      </Field>
                    </>
                  )}
                </>
              )}
              <Field label="E-mail" error={errors.email?.message} tight>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="Ex.: maria@exemplo.com"
                  invalid={Boolean(errors.email)}
                  {...registerField('email')}
                />
              </Field>
              <Field label="Celular" error={errors.phone?.message} tight>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  autoComplete="tel"
                  placeholder="Ex.: 11999999999"
                  invalid={Boolean(errors.phone)}
                  {...registerField('phone', digits('phone', 11))}
                />
              </Field>
              <Field label="CEP" error={errors.zipCode?.message} tight>
                <Input
                  inputMode="numeric"
                  maxLength={8}
                  autoComplete="postal-code"
                  placeholder="Ex.: 01310100"
                  invalid={Boolean(errors.zipCode)}
                  {...registerField('zipCode', digits('zipCode', 8))}
                />
              </Field>
              <Field label="Endereço completo" error={errors.address?.message} tight full>
                <Input
                  autoComplete="street-address"
                  placeholder="Ex.: Avenida Paulista, 1000"
                  invalid={Boolean(errors.address)}
                  {...registerField('address')}
                />
              </Field>
              <Field
                label="Senha"
                error={errors.password?.message}
                hint="Use pelo menos 8 caracteres."
                tight
                full
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Crie uma senha"
                  invalid={Boolean(errors.password)}
                  {...registerField('password')}
                />
              </Field>
              <Field
                label="Confirmar senha"
                error={errors.confirmPassword?.message}
                hint="Repita a senha para confirmar."
                tight
                full
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repita sua senha"
                  invalid={Boolean(errors.confirmPassword)}
                  {...registerField('confirmPassword')}
                />
              </Field>
            </div>

            <Button type="submit" fullWidth className="mt-2" loading={isSubmitting}>
              {isSubmitting ? 'Criando conta…' : 'Criar minha conta'} <PawPrint size={18} />
            </Button>

            <p className="mt-4 text-center text-sm text-muted">
              Já tem conta?{' '}
              <Link to="/entrar" className="font-semibold text-coral hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        </Card>
      </Container>
    </PageSurface>
  )
}
