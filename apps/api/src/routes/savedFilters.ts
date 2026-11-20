import { Router } from 'express'
import { currentUser } from '../context.js'
import { prisma } from '../db.js'
import type { Prisma, SavedFilter } from '../generated/prisma/client.js'
import { sendError } from '../http.js'
import { asRecord, validateSavedFilter } from '../validation.js'

export const savedFiltersRouter = Router()

/** O contrato não expõe o dono da busca salva. */
const presentSavedFilter = ({ userId: _userId, ...savedFilter }: SavedFilter) => savedFilter

const mySavedFilters = (userId: string) =>
  prisma.savedFilter.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  })

savedFiltersRouter.get('/me/saved-filters', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const data = (await mySavedFilters(userId)).map(presentSavedFilter)
  res.json({ data, total: data.length })
})

savedFiltersRouter.post('/me/saved-filters', async (req, res) => {
  const details = validateSavedFilter(req.body)
  if (details.length) return sendError(res, 400, 'Critérios de busca inválidos', details)

  const body = asRecord(req.body)
  if (!body) return sendError(res, 400, 'Critérios de busca inválidos', details)

  const { id: userId } = await currentUser(req)
  const existing = await mySavedFilters(userId)
  if (existing.length >= 10) {
    return sendError(res, 409, 'Você atingiu o limite de 10 buscas salvas')
  }

  const rows = await prisma.savedFilter.findMany({ select: { id: true } })
  const nextId = rows.reduce((max, filter) => Math.max(max, Number(filter.id) || 0), 0) + 1
  const savedFilter = await prisma.savedFilter.create({
    data: {
      id: String(nextId),
      userId,
      name: String(body.name).trim(),
      criteria: body.criteria as Prisma.InputJsonValue,
      active: body.active === true,
      createdAt: new Date(),
    },
  })
  res.status(201).json(presentSavedFilter(savedFilter))
})

savedFiltersRouter.patch('/me/saved-filters/:id', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const savedFilter = await prisma.savedFilter.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!savedFilter) return sendError(res, 404, 'Busca salva não encontrada')

  const details = validateSavedFilter(req.body, true)
  if (details.length) return sendError(res, 400, 'Atualização inválida', details)

  const body = asRecord(req.body)
  if (!body) return sendError(res, 400, 'Atualização inválida', details)

  const data: Prisma.SavedFilterUncheckedUpdateInput = {}
  if (Object.hasOwn(body, 'name')) data.name = String(body.name).trim()
  if (Object.hasOwn(body, 'criteria')) data.criteria = body.criteria as Prisma.InputJsonValue
  if (Object.hasOwn(body, 'active')) data.active = body.active === true

  const updated = await prisma.savedFilter.update({ where: { id: savedFilter.id }, data })
  res.json(presentSavedFilter(updated))
})

savedFiltersRouter.delete('/me/saved-filters/:id', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const savedFilter = await prisma.savedFilter.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!savedFilter) return sendError(res, 404, 'Busca salva não encontrada')
  await prisma.savedFilter.delete({ where: { id: savedFilter.id } })
  res.status(204).end()
})
