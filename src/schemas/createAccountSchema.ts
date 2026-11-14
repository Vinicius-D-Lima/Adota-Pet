import { z } from 'zod'
import { profileSchema } from './profileSchema'

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
})

const guardianAccountSchema = z.object({
  accountType: z.literal('guardian'),
  ...base,
  organizationName: z.string().trim().min(3, 'Informe o nome da instituição.'),
  responsibleName: z.string().trim().min(3, 'Informe o nome do responsável.'),
  document: z
    .string()
    .trim()
    .refine((value) => /^\d{14}$/.test(value), 'Informe um CNPJ com 14 dígitos.'),
  city: z.string().trim().min(2, 'Informe a cidade.'),
  state: z.string().trim().length(2, 'Use a sigla do estado com 2 letras.'),
  zipCode: profileSchema.shape.zipCode,
  address: profileSchema.shape.address,
  name: z.string().optional(),
  cpf: z.string().optional(),
  birthDate: z.string().optional(),
})

export const createAccountSchema = z.discriminatedUnion('accountType', [
  adopterAccountSchema,
  guardianAccountSchema,
])

export type CreateAccountData = z.infer<typeof createAccountSchema>
