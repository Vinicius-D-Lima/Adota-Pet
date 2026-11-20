import { z } from 'zod'

/**
 * Contrato de autenticação (#48) compartilhado com o frontend.
 *
 * `registerSchema` não é `.strict()`: campos privilegiados (`id`, `platformRole`,
 * `passwordHash`) são descartados pelo Zod em vez de gerar erro. É a defesa
 * contra mass assignment exigida por AUTH-14.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
})

export const authLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

export type RegisterData = z.infer<typeof registerSchema>
export type AuthLoginData = z.infer<typeof authLoginSchema>
