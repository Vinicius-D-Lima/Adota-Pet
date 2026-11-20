import { Router } from 'express'
import { currentUser, presentPet, referenceUser } from '../context.js'
import { prisma } from '../db.js'
import { list, sendError } from '../http.js'

export const favoritesRouter = Router()

favoritesRouter.get('/me/favorites/ids', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  res.json(list(favorites.map(({ petId }) => petId)))
})

favoritesRouter.get('/me/favorites', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { pet: true },
  })
  const refUser = await referenceUser()
  res.json(list(favorites.map(({ pet }) => presentPet(pet, refUser))))
})

favoritesRouter.put('/me/favorites/:petId', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const { petId } = req.params
  const pet = await prisma.pet.findUnique({ where: { id: petId } })
  if (!pet) return sendError(res, 404, 'Pet não encontrado')
  await prisma.favorite.upsert({
    where: { userId_petId: { userId, petId } },
    create: { userId, petId, createdAt: new Date() },
    update: {},
  })
  res.status(204).end()
})

favoritesRouter.delete('/me/favorites/:petId', async (req, res) => {
  const { id: userId } = await currentUser(req)
  await prisma.favorite.deleteMany({ where: { userId, petId: req.params.petId } })
  res.status(204).end()
})
