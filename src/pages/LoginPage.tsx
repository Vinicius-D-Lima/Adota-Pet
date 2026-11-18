import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Building2, LogIn, User } from 'lucide-react'
import { useState } from 'react'
import { type Resolver, useForm, useWatch } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Container, cx, Field, Input, PageSurface } from '../components/ui'
import { adopterProfileKey } from '../hooks/useAdopterProfile'
import { guardianProfileKey } from '../hooks/useGuardianProfile'
import { useDemoAccount } from '../hooks/useDemoAccount'
import { type LoginFormData, loginSchema } from '../schemas/loginSchema'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const account = useDemoAccount()
  const [loginError, setLoginError] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema) as Resolver<LoginFormData>,
    defaultValues: {
      accountType: 'adopter',
      email: '',
      password: '',
    },
  })

  const accountType = useWatch({ control, name: 'accountType' })

  const submit = handleSubmit(async (data) => {
    setLoginError('')
    try {
      account.login({
        accountType: data.accountType,
        email: data.email,
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adopterProfileKey }),
        queryClient.invalidateQueries({ queryKey: guardianProfileKey }),
      ])

      const state = location.state as { from?: string } | null
      const destination = state?.from || (data.accountType === 'guardian' ? '/organizacao' : '/')
      navigate(destination, { replace: true })
    } catch {
      setLoginError('Não foi possível entrar. Verifique seus dados e tente novamente.')
    }
  })

  return (
    <PageSurface>
      <Container as="section" className="py-10 md:py-16">
        <Card className="mx-auto max-w-[520px] p-6 md:p-10">
          <div className="mb-7 flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-forest-100 text-forest-800">
              <LogIn size={24} />
            </span>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-coral">
                Acesse sua conta
              </p>
              <h1 className="mb-2 text-[32px] md:text-[38px]">Entrar no AdotaPet</h1>
              <p className="m-0 text-sm leading-6 text-muted">
                Entre para gerenciar seus favoritos, acompanhar solicitações ou seus pets
                cadastrados.
              </p>
            </div>
          </div>

          {loginError && <Alert>{loginError}</Alert>}

          <form className="grid gap-5" onSubmit={submit} noValidate>
            <div>
              <p className="mb-2 block text-xs font-bold">Tipo de acesso</p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-forest-50 p-1">
                <button
                  type="button"
                  onClick={() => setValue('accountType', 'adopter')}
                  className={cx(
                    'flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition',
                    accountType === 'adopter'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-muted hover:text-forest-800',
                  )}
                >
                  <User size={15} /> Adotante
                </button>
                <button
                  type="button"
                  onClick={() => setValue('accountType', 'guardian')}
                  className={cx(
                    'flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition',
                    accountType === 'guardian'
                      ? 'bg-white text-forest-900 shadow-sm'
                      : 'text-muted hover:text-forest-800',
                  )}
                >
                  <Building2 size={15} /> Instituição / Protetor
                </button>
              </div>
            </div>

            <Field label="E-mail" error={errors.email?.message} tight full>
              <Input
                type="email"
                autoComplete="email"
                placeholder="Ex.: seu@email.com"
                invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>

            <Field label="Senha" error={errors.password?.message} tight full>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </Field>

            <Button type="submit" fullWidth className="mt-2" loading={isSubmitting}>
              {isSubmitting ? 'Entrando…' : 'Entrar'} <ArrowRight size={18} />
            </Button>

            <p className="mt-4 text-center text-sm text-muted">
              Não tem conta?{' '}
              <Link to="/cadastro" className="font-semibold text-coral hover:underline">
                Criar
              </Link>
            </p>
          </form>
        </Card>
      </Container>
    </PageSurface>
  )
}
