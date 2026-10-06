import { z } from 'zod'

const digitsOnly = (value: string) => value.replace(/\D/g, '')

const isValidCpf = (value: string) => {
  const cpf = digitsOnly(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, number, index) => total + Number(number) * (length + 1 - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

const isValidCnpj = (value: string) => {
  const cnpj = digitsOnly(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const digit = (base: string, weights: number[]) => {
    const sum = base
      .split('')
      .reduce((total, number, index) => total + Number(number) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = digit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = digit(`${cnpj.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(cnpj[12]) && second === Number(cnpj[13])
}

export const guardianProfileSchema = z
  .object({
    guardianType: z.enum(['INDIVIDUAL', 'ORGANIZATION'], 'Escolha o tipo de responsável.'),
    displayName: z.string().trim(),
    legalName: z.string().trim().min(3, 'Informe o nome completo ou a razão social.'),
    document: z.string().trim().min(1, 'Informe o CPF ou CNPJ.'),
    email: z.string().trim().email('Informe um e-mail válido.'),
    phone: z
      .string()
      .trim()
      .refine((value) => /^\d{10,11}$/.test(digitsOnly(value)), 'Informe um telefone com DDD.'),
    zipCode: z
      .string()
      .trim()
      .refine((value) => /^\d{8}$/.test(digitsOnly(value)), 'Informe um CEP válido.'),
    address: z.string().trim().min(5, 'Informe o endereço do responsável.'),
    city: z.string().trim().min(2, 'Informe a cidade e o estado.'),
    description: z.string().trim().min(20, 'Conte um pouco sobre o trabalho de proteção animal.'),
    acceptsTerms: z.boolean().refine(Boolean, 'Confirme a responsabilidade pelas informações.'),
  })
  .superRefine((profile, context) => {
    if (profile.guardianType === 'ORGANIZATION' && profile.displayName.length < 3) {
      context.addIssue({
        code: 'custom',
        path: ['displayName'],
        message: 'Informe o nome público da instituição.',
      })
    }
    const valid =
      profile.guardianType === 'ORGANIZATION'
        ? isValidCnpj(profile.document)
        : isValidCpf(profile.document)
    if (!valid) {
      context.addIssue({
        code: 'custom',
        path: ['document'],
        message: `Informe um ${profile.guardianType === 'ORGANIZATION' ? 'CNPJ' : 'CPF'} válido.`,
      })
    }
  })

export type GuardianProfile = z.infer<typeof guardianProfileSchema>

export type GuardianProfileDraft = Omit<GuardianProfile, 'guardianType'> & {
  guardianType: GuardianProfile['guardianType'] | ''
}
