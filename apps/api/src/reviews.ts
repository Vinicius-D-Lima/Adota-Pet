import { prisma } from './db.js'
import type { Prisma, ReviewDirection } from './generated/prisma/client.js'

export const REVIEW_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const REVIEW_EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const MIN_REVIEWS_FOR_AVERAGE = 3
export const RECENT_REVIEW_LIMIT = 10

interface ReputationReview {
  id: string
  direction: ReviewDirection
  rating: number
  comment: string
  createdAt: Date
}

export async function recalculateOrganizationReputation(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const aggregate = await tx.review.aggregate({
    where: { revieweeOrganizationId: organizationId, hiddenAt: null },
    _avg: { rating: true },
    _count: { rating: true },
  })
  await tx.organization.update({
    where: { id: organizationId },
    data: {
      reputation: aggregate._avg.rating,
      reviewCount: aggregate._count.rating,
    },
  })
}

export async function getReviewReputation(
  where: Prisma.ReviewWhereInput,
): Promise<{ average: number | null; count: number; reviews: ReputationReview[] }> {
  const filter = { ...where, hiddenAt: null }
  const [aggregate, reviews] = await Promise.all([
    prisma.review.aggregate({
      where: filter,
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.findMany({
      where: filter,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_REVIEW_LIMIT,
      select: {
        id: true,
        direction: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    }),
  ])
  return {
    average:
      aggregate._count.rating >= MIN_REVIEWS_FOR_AVERAGE ? aggregate._avg.rating : null,
    count: aggregate._count.rating,
    reviews,
  }
}
