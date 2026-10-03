import { z } from 'zod'

export const petSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  species: z.string().min(1),
  breed: z.string().min(1),
  age: z.number().nonnegative(),
  ageLabel: z.string().min(1),
  size: z.string().min(1),
  sex: z.string().min(1),
  city: z.string().min(1),
  distance: z.string().nullable(),
  distanceKm: z.number().nonnegative().nullable(),
  image: z.url(),
  gallery: z.array(z.url()).optional(),
  summary: z.string().min(1),
  description: z.string().min(1),
  traits: z.array(z.string().min(1)).min(1),
  energy: z.string().min(1),
  space: z.string().min(1),
  children: z.boolean(),
  otherPets: z.boolean(),
  specialCare: z.boolean(),
  vaccinated: z.boolean(),
  neutered: z.boolean(),
  organization: z.string().min(1),
  organizationInitials: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  createdAt: z.string().min(1),
})

export const petsSchema = z.array(petSchema)
export const petsResponseSchema = z.object({
  data: petsSchema,
  total: z.number().int().nonnegative(),
})

export type Pet = z.infer<typeof petSchema>
export type PetsResponse = z.infer<typeof petsResponseSchema>
