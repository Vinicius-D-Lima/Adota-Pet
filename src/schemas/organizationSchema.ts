import { z } from 'zod'
import { requestPetSchema, requestStatuses } from './requestSchema'

const requiredChoice = (message: string) => z.string().min(1, message)

export const organizationPetFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do pet.'),
  species: requiredChoice('Selecione a espécie.'),
  breed: z.string().trim().min(2, 'Informe a raça ou SRD.'),
  age: z.string().regex(/^\d+$/, 'Informe a idade em anos.'),
  size: requiredChoice('Selecione o porte.'),
  sex: requiredChoice('Selecione o sexo.'),
  city: z.string().trim().min(2, 'Informe a cidade e o estado.'),
  image: z.url('Informe uma URL de imagem válida.'),
  summary: z.string().trim().min(10, 'Escreva um resumo com pelo menos 10 caracteres.'),
  description: z.string().trim().min(20, 'Escreva uma descrição com pelo menos 20 caracteres.'),
  traits: z.string().trim().min(2, 'Informe ao menos uma característica.'),
  energy: requiredChoice('Selecione o nível de energia.'),
  space: z.string().trim().min(2, 'Informe o espaço recomendado.'),
  children: requiredChoice('Informe a convivência com crianças.'),
  otherPets: requiredChoice('Informe a convivência com outros pets.'),
  specialCare: requiredChoice('Informe se exige cuidados especiais.'),
  vaccinated: requiredChoice('Informe se está vacinado.'),
  neutered: requiredChoice('Informe se está castrado.'),
})

export const organizationPetPayloadSchema = organizationPetFormSchema.transform((data) => ({
  ...data,
  age: Number(data.age),
  traits: data.traits
    .split(',')
    .map((trait) => trait.trim())
    .filter(Boolean),
  children: data.children === 'true',
  otherPets: data.otherPets === 'true',
  specialCare: data.specialCare === 'true',
  vaccinated: data.vaccinated === 'true',
  neutered: data.neutered === 'true',
}))

export const receivedRequestSchema = z.object({
  id: z.string().min(1),
  petId: z.string().min(1),
  status: z.enum(requestStatuses),
  date: z.string().min(1),
  message: z.string(),
  pet: requestPetSchema.nullable(),
  answers: z
    .object({
      motivation: z.string(),
      routine: z.string(),
      aloneTime: z.string(),
      adaptation: z.string(),
      costs: z.boolean(),
      commitment: z.boolean(),
    })
    .optional(),
  adopter: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    completion: z.number().min(0).max(100),
    housing: z.string().optional(),
    dailyTime: z.string().optional(),
    experience: z.string().optional(),
    hasChildren: z.boolean().optional(),
    hasOtherPets: z.boolean().optional(),
  }),
})

export const receivedRequestsResponseSchema = z.object({
  data: z.array(receivedRequestSchema),
  total: z.number().int().nonnegative(),
})

export type OrganizationPetFormData = z.input<typeof organizationPetFormSchema>
export type OrganizationPetPayload = z.output<typeof organizationPetPayloadSchema>
export type ReceivedRequest = z.infer<typeof receivedRequestSchema>
