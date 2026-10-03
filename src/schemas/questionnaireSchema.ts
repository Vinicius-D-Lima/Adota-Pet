import { z } from 'zod'

export const questionnaireSchema = z.object({
  motivation: z
    .string()
    .trim()
    .min(20, 'Explique sua motivação usando pelo menos 20 caracteres.')
    .max(500, 'Use no máximo 500 caracteres.'),
  routine: z
    .string()
    .trim()
    .min(20, 'Descreva sua rotina usando pelo menos 20 caracteres.')
    .max(500, 'Use no máximo 500 caracteres.'),
  aloneTime: z.enum(
    ['Até 2 horas', 'Até 4 horas', 'De 4 a 8 horas', 'Mais de 8 horas'],
    'Informe por quanto tempo o pet ficará sozinho.',
  ),
  adaptation: z
    .string()
    .trim()
    .min(15, 'Explique como será a adaptação usando pelo menos 15 caracteres.')
    .max(350, 'Use no máximo 350 caracteres.'),
  costs: z.boolean().refine((value) => value, {
    message: 'Confirme que está ciente dos custos recorrentes.',
  }),
  commitment: z.boolean().refine((value) => value, {
    message: 'Confirme o compromisso com o bem-estar do pet.',
  }),
})

export type QuestionnaireAnswers = z.infer<typeof questionnaireSchema>
