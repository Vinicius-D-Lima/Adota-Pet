import { AlertTriangle, Check, Info, Save } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import {
  type AdopterProfile,
  useAdopterProfile,
  useSaveAdopterProfile,
} from '../hooks/useAdopterProfile'
import { Button, Field, Input, PageIntro, Select } from '../components/ui'
import { ApiError } from '../lib/ApiError'
import { profileSchema } from '../schemas/profileSchema'
import type { ProfileDraft } from '../types'
import { getZodFieldErrors, type FieldErrors } from '../utils/zodFieldErrors'

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

export function ProfilePage() {
  const profileQuery = useAdopterProfile()

  if (profileQuery.isPending) {
    return <div className="app-feedback">Carregando seu perfil...</div>
  }

  if (profileQuery.isError) {
    return (
      <div className="app-feedback error" role="alert">
        Não foi possível carregar seu perfil. Tente novamente.
      </div>
    )
  }

  return <ProfileForm savedProfile={profileQuery.data} />
}

interface ProfileFormProps {
  savedProfile: AdopterProfile
}

function ProfileForm({ savedProfile }: ProfileFormProps) {
  const saveProfile = useSaveAdopterProfile()
  const [draft, setDraft] = useState<ProfileDraft>(savedProfile.profile)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors<keyof ProfileDraft>>({})

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSaved(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saveProfile.isPending) return
    const result = profileSchema.safeParse(draft)
    setSaved(false)
    setSaveError(null)

    if (!result.success) {
      setErrors(getZodFieldErrors<keyof ProfileDraft>(result.error))
      return
    }

    setErrors({})
    try {
      await saveProfile.mutateAsync(result.data)
      setSaved(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        const fieldErrors = Object.entries(error.toFieldErrors()).filter(([field]) =>
          isProfileField(field),
        )
        if (fieldErrors.length > 0) {
          setErrors(Object.fromEntries(fieldErrors))
          return
        }
      }
      setSaveError(SAVE_ERROR_MESSAGE)
    }
  }

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
    <div className="page-surface">
      <section className="container page-section profile-page">
        <PageIntro
          eyebrow="Seu espaço no AdotaPet"
          title="Perfil do adotante"
          description="Essas informações são usadas para calcular sua compatibilidade e apoiar uma adoção responsável."
        />
        {saved && (
          <div className="save-message" role="status">
            <Check size={18} /> Perfil atualizado. As próximas compatibilidades usarão estes dados.
          </div>
        )}
        {saveError && (
          <div className="save-message save-error" role="alert">
            <AlertTriangle size={18} /> {saveError}
          </div>
        )}
        {!savedProfile.isComplete && (
          <div className="save-message profile-incomplete" role="status">
            <AlertTriangle size={18} />
            <div>
              <strong>Seu perfil salvo está incompleto.</strong>
              {savedMissingFields.length > 0 && <> Complete: {savedMissingFields.join(', ')}.</>}
            </div>
          </div>
        )}
        <form className="profile-form" onSubmit={submit} noValidate>
          <aside className="profile-aside">
            <div className="profile-tracker">
              <div className="profile-tracker-heading">
                <h2>Acompanhe seu perfil</h2>
                <p>Perfil {completionPercentage}% completo</p>
              </div>
              <div
                className="profile-progress"
                role="progressbar"
                aria-label="Completude do perfil"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completionPercentage}
              >
                <span style={{ width: `${completionPercentage}%` }} />
              </div>
              <div className="profile-missing" aria-live="polite">
                {missingFields.length > 0 ? (
                  <>
                    <h3>
                      {missingFields.length === 1
                        ? 'Falta 1 campo'
                        : `Faltam ${missingFields.length} campos`}
                    </h3>
                    <ul>
                      {missingFields.map(([key, label]) => (
                        <li key={key}>{label}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="profile-complete">Todos os campos foram preenchidos.</p>
                )}
              </div>
              <div className="info-note">
                <Info size={17} />
                <p>
                  Seus dados são compartilhados apenas com a organização quando você envia uma
                  solicitação.
                </p>
              </div>
            </div>
          </aside>
          <div className="profile-fields">
            <section>
              <div className="form-section-heading">
                <span>1</span>
                <div>
                  <h2>Informações pessoais</h2>
                  <p>Dados de identificação e contato do responsável pela adoção.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Nome completo" error={errors.name} full>
                  <Input
                    value={draft.name}
                    onChange={(event) => update('name', event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    placeholder="Digite seu nome completo"
                    autoComplete="name"
                  />
                </Field>
                <Field label="CPF" error={errors.cpf}>
                  <Input
                    value={draft.cpf}
                    onChange={(event) =>
                      update('cpf', event.target.value.replace(/\D/g, '').slice(0, 11))
                    }
                    aria-invalid={Boolean(errors.cpf)}
                    placeholder="Ex.: 52998224725"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Data de nascimento"
                  error={errors.birthDate}
                  hint="É necessário ter pelo menos 18 anos."
                >
                  <Input
                    type="date"
                    value={draft.birthDate}
                    onChange={(event) => update('birthDate', event.target.value)}
                    aria-invalid={Boolean(errors.birthDate)}
                    autoComplete="bday"
                  />
                </Field>
                <Field label="E-mail" error={errors.email}>
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(event) => update('email', event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Telefone/celular" error={errors.phone}>
                  <Input
                    type="tel"
                    value={draft.phone}
                    onChange={(event) =>
                      update('phone', event.target.value.replace(/\D/g, '').slice(0, 11))
                    }
                    aria-invalid={Boolean(errors.phone)}
                    placeholder="Ex.: 11999999999"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    autoComplete="tel"
                  />
                </Field>
                <Field label="CEP" error={errors.zipCode}>
                  <Input
                    value={draft.zipCode}
                    onChange={(event) =>
                      update('zipCode', event.target.value.replace(/\D/g, '').slice(0, 8))
                    }
                    aria-invalid={Boolean(errors.zipCode)}
                    placeholder="Ex.: 01001000"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    autoComplete="postal-code"
                  />
                </Field>
                <Field label="Endereço" error={errors.address} full>
                  <Input
                    value={draft.address}
                    onChange={(event) => update('address', event.target.value)}
                    aria-invalid={Boolean(errors.address)}
                    placeholder="Rua, número, bairro e cidade"
                    autoComplete="street-address"
                  />
                </Field>
              </div>
            </section>

            <section>
              <div className="form-section-heading">
                <span>2</span>
                <div>
                  <h2>Moradia e composição da casa</h2>
                  <p>Conte como é o ambiente onde o pet viverá.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Tipo de moradia" error={errors.housing}>
                  <Select
                    value={draft.housing}
                    onChange={(event) =>
                      update('housing', event.target.value as ProfileDraft['housing'])
                    }
                    aria-invalid={Boolean(errors.housing)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Apartamento</option>
                    <option>Casa</option>
                    <option>Chácara ou sítio</option>
                  </Select>
                </Field>
                <Field label="Área externa segura?" error={errors.hasOutdoorArea}>
                  <Select
                    value={draft.hasOutdoorArea === '' ? '' : draft.hasOutdoorArea ? 'Sim' : 'Não'}
                    onChange={(event) =>
                      update(
                        'hasOutdoorArea',
                        event.target.value === '' ? '' : event.target.value === 'Sim',
                      )
                    }
                    aria-invalid={Boolean(errors.hasOutdoorArea)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Não</option>
                    <option>Sim</option>
                  </Select>
                </Field>
                <Field label="Há crianças na residência?" error={errors.hasChildren}>
                  <Select
                    value={draft.hasChildren === '' ? '' : draft.hasChildren ? 'Sim' : 'Não'}
                    onChange={(event) =>
                      update(
                        'hasChildren',
                        event.target.value === '' ? '' : event.target.value === 'Sim',
                      )
                    }
                    aria-invalid={Boolean(errors.hasChildren)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Não</option>
                    <option>Sim</option>
                  </Select>
                </Field>
                <Field label="Já há outros pets?" error={errors.hasOtherPets}>
                  <Select
                    value={draft.hasOtherPets === '' ? '' : draft.hasOtherPets ? 'Sim' : 'Não'}
                    onChange={(event) =>
                      update(
                        'hasOtherPets',
                        event.target.value === '' ? '' : event.target.value === 'Sim',
                      )
                    }
                    aria-invalid={Boolean(errors.hasOtherPets)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Não</option>
                    <option>Sim</option>
                  </Select>
                </Field>
              </div>
            </section>

            <section>
              <div className="form-section-heading">
                <span>3</span>
                <div>
                  <h2>Rotina e experiência</h2>
                  <p>Isso nos ajuda a considerar energia, companhia e cuidados.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Tempo disponível por dia" error={errors.dailyTime}>
                  <Select
                    value={draft.dailyTime}
                    onChange={(event) =>
                      update('dailyTime', event.target.value as ProfileDraft['dailyTime'])
                    }
                    aria-invalid={Boolean(errors.dailyTime)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Até 1 hora</option>
                    <option>2 a 3 horas</option>
                    <option>Mais de 3 horas</option>
                  </Select>
                </Field>
                <Field label="Nível de atividade" error={errors.activityLevel}>
                  <Select
                    value={draft.activityLevel}
                    onChange={(event) =>
                      update('activityLevel', event.target.value as ProfileDraft['activityLevel'])
                    }
                    aria-invalid={Boolean(errors.activityLevel)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Tranquilo</option>
                    <option>Moderado</option>
                    <option>Ativo</option>
                  </Select>
                </Field>
                <Field label="Experiência com animais" error={errors.experience}>
                  <Select
                    value={draft.experience}
                    onChange={(event) =>
                      update('experience', event.target.value as ProfileDraft['experience'])
                    }
                    aria-invalid={Boolean(errors.experience)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Primeiro pet</option>
                    <option>Já tive pets</option>
                    <option>Tenho bastante experiência</option>
                  </Select>
                </Field>
                <Field
                  label="Disponibilidade para cuidados especiais?"
                  error={errors.acceptsSpecialCare}
                >
                  <Select
                    value={
                      draft.acceptsSpecialCare === ''
                        ? ''
                        : draft.acceptsSpecialCare
                          ? 'Sim'
                          : 'Não'
                    }
                    onChange={(event) =>
                      update(
                        'acceptsSpecialCare',
                        event.target.value === '' ? '' : event.target.value === 'Sim',
                      )
                    }
                    aria-invalid={Boolean(errors.acceptsSpecialCare)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Não</option>
                    <option>Sim</option>
                  </Select>
                </Field>
              </div>
            </section>

            <section>
              <div className="form-section-heading">
                <span>4</span>
                <div>
                  <h2>Preferências</h2>
                  <p>Preferências ajudam na busca, mas não limitam suas possibilidades.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Espécie" error={errors.preferredSpecies}>
                  <Select
                    value={draft.preferredSpecies}
                    onChange={(event) =>
                      update(
                        'preferredSpecies',
                        event.target.value as ProfileDraft['preferredSpecies'],
                      )
                    }
                    aria-invalid={Boolean(errors.preferredSpecies)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Sem preferência</option>
                    <option>Cachorro</option>
                    <option>Gato</option>
                  </Select>
                </Field>
                <Field label="Porte" error={errors.preferredSize}>
                  <Select
                    value={draft.preferredSize}
                    onChange={(event) =>
                      update('preferredSize', event.target.value as ProfileDraft['preferredSize'])
                    }
                    aria-invalid={Boolean(errors.preferredSize)}
                  >
                    <option value="" disabled>
                      Selecione uma opção
                    </option>
                    <option>Sem preferência</option>
                    <option>Pequeno</option>
                    <option>Pequeno ou médio</option>
                    <option>Médio ou grande</option>
                  </Select>
                </Field>
              </div>
            </section>

            <div className="profile-submit">
              <p>Alterações relevantes podem mudar os resultados de compatibilidade.</p>
              <Button type="submit" disabled={saveProfile.isPending}>
                <Save size={18} /> {saveProfile.isPending ? 'Salvando…' : 'Salvar perfil'}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
