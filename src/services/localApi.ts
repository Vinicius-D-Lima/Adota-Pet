import { pets } from '../data/pets'
import { petsSchema } from '../schemas/petSchema'
import type { Pet } from '../types'

export async function getPets(): Promise<Pet[]> {
  return petsSchema.parse(pets)
}
