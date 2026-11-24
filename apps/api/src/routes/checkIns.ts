import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { loadConfig } from '../config.js'
import { prisma } from '../db.js'
import { recordCheckInReview } from '../checkIns.js'
import { HttpError, sendError } from '../http.js'
import { logger } from '../logger.js'
import {
  getStorageProvider,
  isStorageConfigured,
  signObjectUrl,
  STORAGE_SCOPES,
  validateUploadFiles,
} from '../storage.js'
import { validate } from '../validate.js'

const checkInIdParamsSchema = z.strictObject({ id: z.string().min(1).max(120) })
const checkInPhotoParamsSchema = z.strictObject({
  id: z.string().min(1).max(120),
  photoId: z.string().min(1).max(120),
})

export const checkInSubmitBodySchema = z.strictObject({
  report: z.string().trim().min(1).max(5000),
})
export const checkInReviewBodySchema = z.strictObject({
  reviewerComment: z.string().trim().min(1).max(1000),
})

const multipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: STORAGE_SCOPES.checkInPhoto.maxFiles,
    fileSize: STORAGE_SCOPES.checkInPhoto.maxBytesPerFile,
  },
})

function multipart(req: Request, res: Response, next: NextFunction) {
  multipartUpload.array('files')(req, res, (error: unknown) => {
    if (error) {
      return next(
        new HttpError(400, 'Upload inválido', [
          { field: 'files', message: (error as Error).message },
        ]),
      )
    }
    next()
  })
}

const checkInWithAdoption = (id: string) =>
  prisma.checkIn.findUnique({
    where: { id },
    include: {
      adoption: {
        select: {
          adopterId: true,
          organizationId: true,
          pet: { select: { name: true } },
        },
      },
    },
  })

async function isActiveMember(userId: string, organizationId: string) {
  return Boolean(
    await prisma.membership.findFirst({
      where: { userId, organizationId, status: 'ATIVO' },
      select: { id: true },
    }),
  )
}

async function deleteUploadedKeys(keys: string[], provider: ReturnType<typeof getStorageProvider>) {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await provider.deleteObject(key)
      } catch (error) {
        logger.warn({ err: error, key }, 'falha ao limpar upload incompleto de check-in')
      }
    }),
  )
}

async function deletePreviousPhotos(
  checkInId: string,
  photoIds: string[],
  provider: ReturnType<typeof getStorageProvider>,
) {
  if (!photoIds.length) return

  try {
    const objects = await prisma.storageObject.findMany({
      where: { id: { in: photoIds }, resourceType: 'CHECK_IN', resourceId: checkInId },
    })
    await Promise.all(
      objects.map(async (object) => {
        try {
          await provider.deleteObject(object.key)
          await prisma.storageObject.delete({ where: { id: object.id } })
        } catch (error) {
          logger.warn({ err: error, key: object.key }, 'falha ao limpar fotos substituídas')
        }
      }),
    )
  } catch (error) {
    logger.warn({ err: error, checkInId }, 'falha ao localizar fotos substituídas')
  }
}

export const checkInsRouter = Router()

checkInsRouter.post(
  '/check-ins/:id/submit',
  multipart,
  validate({ params: checkInIdParamsSchema, body: checkInSubmitBodySchema }),
  async (req, res) => {
    const { id } = req.params as { id: string }
    const { report } = req.body as z.infer<typeof checkInSubmitBodySchema>
    const checkIn = await checkInWithAdoption(id)
    if (!checkIn) return sendError(res, 404, 'Check-in não encontrado')
    if (checkIn.adoption.adopterId !== req.auth!.userId) {
      return sendError(res, 403, 'Somente o adotante pode enviar este check-in')
    }
    if (!['PENDENTE', 'ATRASADO'].includes(checkIn.status)) {
      return sendError(res, 409, 'Este check-in não pode ser enviado neste estado')
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    const prepared = await validateUploadFiles(files, STORAGE_SCOPES.checkInPhoto)
    const config = loadConfig()
    if (!isStorageConfigured(config)) return sendError(res, 503, 'Armazenamento não configurado')
    let provider: ReturnType<typeof getStorageProvider>
    try {
      provider = getStorageProvider(config)
    } catch (error) {
      logger.error({ err: error, checkInId: checkIn.id }, 'configuração de armazenamento inválida')
      return sendError(res, 503, 'Armazenamento indisponível')
    }
    const uploadedKeys: string[] = []

    try {
      await provider.ensureBucket()
      for (const file of prepared) {
        uploadedKeys.push(file.key)
        await provider.putObject(file)
      }
    } catch (error) {
      await deleteUploadedKeys(uploadedKeys, provider)
      logger.error({ err: error, checkInId: checkIn.id }, 'falha no armazenamento de check-in')
      return sendError(res, 503, 'Armazenamento indisponível')
    }

    let updated
    try {
      updated = await prisma.$transaction(async (tx) => {
        const records: Array<{ id: string }> = []
        for (const file of prepared) {
          records.push(
            await tx.storageObject.create({
              data: {
                key: file.key,
                contentType: file.contentType,
                sizeBytes: file.body.byteLength,
                resourceType: 'CHECK_IN',
                resourceId: checkIn.id,
                ownerId: req.auth!.userId,
              },
            }),
          )
        }

        const changed = await tx.checkIn.updateMany({
          where: { id: checkIn.id, status: { in: ['PENDENTE', 'ATRASADO'] } },
          data: {
            status: 'ENVIADO',
            submittedAt: new Date(),
            report,
            photos: records.map(({ id: photoId }) => photoId),
            reviewerComment: null,
            reviewedAt: null,
          },
        })
        if (changed.count !== 1) {
          throw new HttpError(409, 'Este check-in não pode ser enviado neste estado')
        }
        return tx.checkIn.findUniqueOrThrow({ where: { id: checkIn.id } })
      })
    } catch (error) {
      await deleteUploadedKeys(uploadedKeys, provider)
      throw error
    }

    await deletePreviousPhotos(checkIn.id, checkIn.photos, provider)
    res.json(updated)
  },
)

async function updateReviewedCheckIn(
  id: string,
  userId: string,
  reviewerComment: string,
  status: 'REVISADO' | 'PENDENTE',
) {
  const checkIn = await checkInWithAdoption(id)
  if (!checkIn) return { error: 'not-found' as const }
  if (!(await isActiveMember(userId, checkIn.adoption.organizationId))) {
    return { error: 'forbidden' as const }
  }
  if (checkIn.status !== 'ENVIADO') return { error: 'conflict' as const }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.checkIn.updateMany({
      where: { id: checkIn.id, status: 'ENVIADO' },
      data: {
        status,
        reviewerComment,
        reviewedAt: status === 'REVISADO' ? new Date() : null,
      },
    })
    if (changed.count !== 1) return null

    await recordCheckInReview(tx, {
      adoptionId: checkIn.adoptionId,
      checkInId: checkIn.id,
      adopterId: checkIn.adoption.adopterId,
      petName: checkIn.adoption.pet.name,
      status,
    })
    return tx.checkIn.findUniqueOrThrow({ where: { id: checkIn.id } })
  })
  return updated ? { checkIn: updated } : { error: 'conflict' as const }
}

async function respondToReview(req: Request, res: Response, status: 'REVISADO' | 'PENDENTE') {
  const { id } = req.params as { id: string }
  const { reviewerComment } = req.body as z.infer<typeof checkInReviewBodySchema>
  const result = await updateReviewedCheckIn(id, req.auth!.userId, reviewerComment, status)
  if ('error' in result) {
    if (result.error === 'not-found') return sendError(res, 404, 'Check-in não encontrado')
    if (result.error === 'forbidden') {
      return sendError(res, 403, 'Somente membros ativos da organização podem revisar')
    }
    return sendError(res, 409, 'Este check-in não pode ser revisado neste estado')
  }
  return res.json(result.checkIn)
}

checkInsRouter.post(
  '/check-ins/:id/review',
  validate({ params: checkInIdParamsSchema, body: checkInReviewBodySchema }),
  async (req, res) => respondToReview(req, res, 'REVISADO'),
)

checkInsRouter.post(
  '/check-ins/:id/request-more',
  validate({ params: checkInIdParamsSchema, body: checkInReviewBodySchema }),
  async (req, res) => respondToReview(req, res, 'PENDENTE'),
)

checkInsRouter.post(
  '/check-ins/:id/photos/:photoId/url',
  validate({ params: checkInPhotoParamsSchema }),
  async (req, res) => {
    const { id, photoId } = req.params as { id: string; photoId: string }
    const checkIn = await checkInWithAdoption(id)
    if (!checkIn) return sendError(res, 404, 'Check-in não encontrado')

    const userId = req.auth!.userId
    const isAdopter = checkIn.adoption.adopterId === userId
    const isMember = !isAdopter && (await isActiveMember(userId, checkIn.adoption.organizationId))
    if (!isAdopter && !isMember) return sendError(res, 403, 'Sem acesso às fotos deste check-in')
    if (!checkIn.photos.includes(photoId)) return sendError(res, 404, 'Foto não encontrada')

    const object = await prisma.storageObject.findFirst({
      where: { id: photoId, resourceType: 'CHECK_IN', resourceId: checkIn.id },
    })
    if (!object) return sendError(res, 404, 'Foto não encontrada')

    const config = loadConfig()
    if (!isStorageConfigured(config)) return sendError(res, 503, 'Armazenamento não configurado')
    const signed = await signObjectUrl(
      object.id,
      config.STORAGE_SIGNED_URL_TTL_SECONDS,
      config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
    )
    res.json(signed)
  },
)
