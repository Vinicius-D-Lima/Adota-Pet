import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Digite um e-mail válido.'),
  password: z
    .string()
    .min(1, 'Informe sua senha.')
    .min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  accountType: z.enum(['adopter', 'guardian']).default('adopter'),
})

export type LoginFormData = z.infer<typeof loginSchema>
