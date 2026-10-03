import { z } from 'zod'

const digitsOnly = (value: string) => value.replace(/\D/g, '')

const requiredBoolean = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.boolean('Selecione uma opção.'),
)

const isValidCpf = (value: string) => {
  const cpf = digitsOnly(value)

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const calculateDigit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
}

const isAdult = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const birthDate = new Date(year, month - 1, day)

  if (
    birthDate.getFullYear() !== year
    || birthDate.getMonth() !== month - 1
    || birthDate.getDate() !== day
  ) return false

  const today = new Date()
  let age = today.getFullYear() - year
  const birthdayHasNotOccurred = today.getMonth() < month - 1
    || (today.getMonth() === month - 1 && today.getDate() < day)

  if (birthdayHasNotOccurred) age -= 1
  return age >= 18
}

export const profileSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
  cpf: z.string().trim().refine(isValidCpf, 'Informe um CPF válido.'),
  birthDate: z.string().refine(isAdult, 'É necessário ter pelo menos 18 anos.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  phone: z.string().trim().refine(
    (value) => /^\d{10,11}$/.test(digitsOnly(value)),
    'Informe um telefone com DDD.',
  ),
  zipCode: z.string().trim().refine(
    (value) => /^\d{8}$/.test(digitsOnly(value)),
    'Informe um CEP válido.',
  ),
  address: z.string().trim().min(5, 'Informe seu endereço.'),
  housing: z.enum(['Apartamento', 'Casa', 'Chácara ou sítio'], 'Informe o tipo de moradia.'),
  hasOutdoorArea: requiredBoolean,
  dailyTime: z.enum(['Até 1 hora', '2 a 3 horas', 'Mais de 3 horas'], 'Informe o tempo disponível.'),
  activityLevel: z.enum(['Tranquilo', 'Moderado', 'Ativo'], 'Informe seu nível de atividade.'),
  hasChildren: requiredBoolean,
  hasOtherPets: requiredBoolean,
  experience: z.enum(['Primeiro pet', 'Já tive pets', 'Tenho bastante experiência'], 'Informe sua experiência com animais.'),
  acceptsSpecialCare: requiredBoolean,
  preferredSpecies: z.enum(['Sem preferência', 'Cachorro', 'Gato'], 'Informe a espécie desejada.'),
  preferredSize: z.enum(
    ['Sem preferência', 'Pequeno', 'Pequeno ou médio', 'Médio ou grande'],
    'Informe o porte desejado.',
  ),
})

export type Profile = z.infer<typeof profileSchema>

export type ProfileDraft = {
  [Key in keyof Profile]: Profile[Key] extends boolean
    ? Profile[Key] | ''
    : Profile[Key] extends string
      ? Profile[Key] | ''
      : Profile[Key]
}
