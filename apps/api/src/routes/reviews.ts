import { Router } from 'express'
import { reviewBodySchema } from '@adotapet/shared'
import { currentUser } from '../context.js'
import { prisma } from '../db.js'
import { Prisma, type ReviewDirection } from '../generated/prisma/client.js'
import { sendError } from '../http.js'
import {
  getReviewReputation,
  recalculateOrganizationReputation,
  REVIEW_EDIT_WINDOW_MS,
  REVIEW_MIN_AGE_MS,
} from '../reviews.js'
import { validate } from '../validate.js'

export const reputationRouter = Router()
export const reviewsRouter = Router()

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

const reviewView = (review: {
  id: string
  adoptionId: string
  direction: ReviewDirection
  rating: number
  comment: string
  createdAt: Date
  updatedAt: Date
}) => ({
  id: review.id,
  adoptionId: review.adoptionId,
  direction: review.direction,
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString(),
})

reputationRouter.get('/users/:id/reputation', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  })
  if (!user) return sendError(res, 404, 'Usuário não encontrado')
  res.json(await getReviewReputation({ revieweeId: user.id }))
})

reputationRouter.get('/organizations/:id/reputation', async (req, res) => {
  const organization = await prisma.organization.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  })
  if (!organization) return sendError(res, 404, 'Organização não encontrada')
  res.json(await getReviewReputation({ revieweeOrganizationId: organization.id }))
})

reviewsRouter.post(
  '/adoptions/:id/reviews',
  validate({ body: reviewBodySchema }),
  async (req, res) => {
    const adoptionId = req.params.id
    if (typeof adoptionId !== 'string') {
      return sendError(res, 400, 'Identificador da adoção inválido')
    }
    const adoption = await prisma.adoption.findUnique({
      where: { id: adoptionId },
      select: { id: true, adopterId: true, organizationId: true, adoptedAt: true },
    })
    if (!adoption) return sendError(res, 404, 'Adoção não encontrada')

    const { id: userId } = await currentUser(req)
    let direction: ReviewDirection
    let revieweeId: string | null = null
    let revieweeOrganizationId: string | null = null

    if (userId === adoption.adopterId) {
      direction = 'ADOPTER_TO_ORGANIZATION'
      revieweeOrganizationId = adoption.organizationId
    } else {
      const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: adoption.organizationId, status: 'ATIVO' },
        select: { id: true },
      })
      if (!membership) {
        return sendError(res, 403, 'Somente os participantes da adoção podem avaliar')
      }
      direction = 'ORGANIZATION_TO_ADOPTER'
      revieweeId = adoption.adopterId
    }

    if (Date.now() < adoption.adoptedAt.getTime() + REVIEW_MIN_AGE_MS) {
      return sendError(res, 409, 'As avaliações ficam disponíveis sete dias após a adoção')
    }

    try {
      const review = await prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            adoptionId: adoption.id,
            reviewerId: userId,
            direction,
            revieweeId,
            revieweeOrganizationId,
            rating: req.body.rating,
            comment: req.body.comment,
          },
        })
        if (revieweeOrganizationId) {
          await recalculateOrganizationReputation(tx, revieweeOrganizationId)
        }
        return created
      })
      res.status(201).json(reviewView(review))
    } catch (error) {
      if (isUniqueViolation(error)) {
        return sendError(res, 409, 'Esta avaliação já foi enviada')
      }
      throw error
    }
  },
)

reviewsRouter.put(
  '/reviews/:id',
  validate({ body: reviewBodySchema }),
  async (req, res) => {
    const reviewId = req.params.id
    if (typeof reviewId !== 'string') {
      return sendError(res, 400, 'Identificador da avaliação inválido')
    }
    const existing = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        reviewerId: true,
        revieweeOrganizationId: true,
        hiddenAt: true,
        createdAt: true,
      },
    })
    if (!existing) return sendError(res, 404, 'Avaliação não encontrada')

    const { id: userId } = await currentUser(req)
    if (existing.reviewerId !== userId) {
      return sendError(res, 403, 'Somente quem enviou a avaliação pode editá-la')
    }
    if (
      existing.hiddenAt ||
      Date.now() > existing.createdAt.getTime() + REVIEW_EDIT_WINDOW_MS
    ) {
      return sendError(res, 409, 'O prazo para editar esta avaliação expirou')
    }

    const review = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.updateMany({
        where: {
          id: existing.id,
          reviewerId: userId,
          hiddenAt: null,
          createdAt: { gte: new Date(Date.now() - REVIEW_EDIT_WINDOW_MS) },
        },
        data: { rating: req.body.rating, comment: req.body.comment },
      })
      if (updated.count !== 1) return null

      const result = await tx.review.findUniqueOrThrow({ where: { id: existing.id } })
      if (result.revieweeOrganizationId) {
        await recalculateOrganizationReputation(tx, result.revieweeOrganizationId)
      }
      return result
    })
    if (!review) return sendError(res, 409, 'O prazo para editar esta avaliação expirou')
    res.json(reviewView(review))
  },
)
