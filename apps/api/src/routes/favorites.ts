import { Router } from 'express'
import {
  favoritePetIdParamsSchema,
  favoritesQuerySchema,
  type FavoritePetSummary,
  type FavoritesQuery,
} from '@adotapet/shared'
import { currentUser, presentPet, referenceUser } from '../context.js'
import { prisma } from '../db.js'
import type { User } from '../generated/prisma/client.js'
import type { PetWithOrganization } from '../context.js'
import { list, sendError } from '../http.js'
import { validate } from '../validate.js'
import { petMedicalInclude } from '../medicalRecords.js'

export const favoritesRouter = Router()

/**
 * Resumo do favorito (#51): campos do card, sem coordenadas nem textos longos.
 * `status` é obrigatório e normalizado para que pets adotados/arquivados
 * continuem na lista com sinalização explícita.
 */
function presentFavoritePet(pet: PetWithOrganization, refUser: User | null): FavoritePetSummary {
  const presented = presentPet(pet, refUser)
  const { distanceKm, distance } = presented
  const status: FavoritePetSummary['status'] =
    pet.status === 'ADOTADO' || pet.status === 'ARQUIVADO' ? pet.status : 'DISPONIVEL'

  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: pet.age,
    ageLabel: pet.ageLabel,
    size: pet.size,
    sex: pet.sex,
    city: pet.city,
    image: pet.image,
    summary: pet.summary,
    traits: pet.traits,
    vaccinated: presented.vaccinated,
    neutered: presented.neutered,
    organization: presented.organization,
    status,
    distanceKm,
    distance,
  }
}

favoritesRouter.get('/me/favorites/ids', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  res.json(list(favorites.map(({ petId }) => petId)))
})

favoritesRouter.get(
  '/me/favorites',
  validate({ query: favoritesQuerySchema }),
  async (req, res) => {
    const { id: userId } = await currentUser(req)
    const { page, limit } = req.query as unknown as FavoritesQuery
    const where = { userId }

    // `total` é a contagem global de favoritos do usuário, não o tamanho da página.
    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { pet: { include: petMedicalInclude } },
      }),
      prisma.favorite.count({ where }),
    ])
    const refUser = await referenceUser()

    res.json({ data: favorites.map(({ pet }) => presentFavoritePet(pet, refUser)), total })
  },
)

favoritesRouter.put(
  '/me/favorites/:petId',
  validate({ params: favoritePetIdParamsSchema }),
  async (req, res) => {
    const { id: userId } = await currentUser(req)
    const { petId } = req.params as { petId: string }
    const pet = await prisma.pet.findUnique({ where: { id: petId } })
    if (!pet) return sendError(res, 404, 'Pet não encontrado')
    await prisma.favorite.upsert({
      where: { userId_petId: { userId, petId } },
      create: { userId, petId, createdAt: new Date() },
      update: {},
    })
    res.status(204).end()
  },
)

favoritesRouter.delete(
  '/me/favorites/:petId',
  validate({ params: favoritePetIdParamsSchema }),
  async (req, res) => {
    const { id: userId } = await currentUser(req)
    const { petId } = req.params as { petId: string }
    await prisma.favorite.deleteMany({ where: { userId, petId } })
    res.status(204).end()
  },
)
