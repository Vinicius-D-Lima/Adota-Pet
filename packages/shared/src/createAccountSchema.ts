import { z } from 'zod'
import { isValidCnpj, isValidCpf } from './guardianProfileSchema.js'
import { profileSchema } from './profileSchema.js'

const phone = z
  .string()
  .trim()
  .refine((value) => /^\d{10,11}$/.test(value.replace(/\D/g, '')), 'Informe um telefone com DDD.')

const base = {
  email: z.string().trim().email('Informe um e-mail válido.'),
  phone,
  password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
}

const adopterAccountSchema = z.object({
  accountType: z.literal('adopter'),
  ...base,
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
  cpf: profileSchema.shape.cpf,
  birthDate: profileSchema.shape.birthDate,
  zipCode: profileSchema.shape.zipCode,
  address: profileSchema.shape.address,
  organizationName: z.string().optional(),
  responsibleName: z.string().optional(),
  document: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  guardianType: z.enum(['INDIVIDUAL', 'ORGANIZATION']).optional(),
})

const guardianAccountSchema = z
  .object({
    accountType: z.literal('guardian'),
    guardianType: z.enum(
      ['INDIVIDUAL', 'ORGANIZATION'],
      'Escolha entre pessoa física e instituição.',
    ),
    ...base,
    organizationName: z.string().trim().optional(),
    responsibleName: z.string().trim().min(3, 'Informe o nome completo do responsável.'),
    document: z.string().trim().min(1, 'Informe o CPF ou CNPJ.'),
    city: z.string().trim().min(2, 'Informe a cidade.'),
    state: z.string().trim().length(2, 'Use a sigla do estado com 2 letras.'),
    zipCode: profileSchema.shape.zipCode,
    address: profileSchema.shape.address,
    name: z.string().optional(),
    cpf: z.string().optional(),
    birthDate: z.string().optional(),
  })
  .superRefine((account, context) => {
    if (
      account.guardianType === 'ORGANIZATION' &&
      (!account.organizationName || account.organizationName.length < 3)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['organizationName'],
        message: 'Informe o nome da instituição.',
      })
    }

    const validDocument =
      account.guardianType === 'ORGANIZATION'
        ? isValidCnpj(account.document)
        : isValidCpf(account.document)
    if (!validDocument) {
      context.addIssue({
        code: 'custom',
        path: ['document'],
        message: `Informe um ${account.guardianType === 'ORGANIZATION' ? 'CNPJ' : 'CPF'} válido.`,
      })
    }
  })

export const createAccountSchema = z.discriminatedUnion('accountType', [
  adopterAccountSchema,
  guardianAccountSchema,
])

export type CreateAccountData = z.infer<typeof createAccountSchema>
