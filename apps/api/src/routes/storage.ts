import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import {
  storageFileQuerySchema,
  storageObjectIdParamsSchema,
  storageUploadBodySchema,
  type StorageUploadBody,
} from '@adotapet/shared'
import { requireAuth } from '../auth.js'
import { loadConfig } from '../config.js'
import { prisma } from '../db.js'
import { HttpError, list, sendError } from '../http.js'
import { logger } from '../logger.js'
import { canManageMedicalExam, canViewMedicalExam } from '../medicalRecords.js'
import {
  getStorageProvider,
  isStorageConfigured,
  signObjectUrl,
  STORAGE_SCOPES,
  validateUploadFiles,
  verifyObjectToken,
} from '../storage.js'
import { validate } from '../validate.js'

/**
 * Upload e metadados (#94). Toda leitura sai por `/files/:id?token=...`, cuja
 * assinatura curta é emitida só para o dono do objeto (STO-02/03/06).
 */

// Teto absoluto do parser; os limites por escopo são aplicados no serviço.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
})

function multipart(req: Request, res: Response, next: NextFunction) {
  upload.array('files')(req, res, (error: unknown) => {
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

function serviceUnavailable(res: Response) {
  sendError(res, 503, 'Armazenamento não configurado')
}

export const storageRouter = Router()

storageRouter.post(
  '/storage/objects',
  requireAuth,
  multipart,
  validate({ body: storageUploadBodySchema }),
  async (req, res) => {
    const config = loadConfig()
    if (!isStorageConfigured(config)) return serviceUnavailable(res)

    const { scope, resourceType, resourceId } = req.body as StorageUploadBody
    if (resourceType === 'MEDICAL_EXAM') {
      if (scope !== 'medicalExam' || !(await canManageMedicalExam(resourceId, req.user!.id))) {
        return sendError(res, 403, 'Sem permissão para anexar arquivos a este exame')
      }
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    const prepared = await validateUploadFiles(files, STORAGE_SCOPES[scope])
    const provider = getStorageProvider(config)

    try {
      await provider.ensureBucket()
      const objects = []
      for (const file of prepared) {
        const stored = await provider.putObject(file)
        const record = await prisma.storageObject.create({
          data: {
            key: stored.key,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            resourceType,
            resourceId,
            ownerId: req.auth!.userId,
          },
        })
        if (resourceType === 'MEDICAL_EXAM') {
          await prisma.exam.update({ where: { id: resourceId }, data: { attachment: record.id } })
        }
        const signed = await signObjectUrl(
          record.id,
          config.STORAGE_SIGNED_URL_TTL_SECONDS,
          config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
        )
        objects.push({
          id: record.id,
          key: record.key,
          contentType: record.contentType,
          sizeBytes: record.sizeBytes,
          ...signed,
        })
      }
      res.status(201).json(list(objects))
    } catch (error) {
      logger.error({ err: error }, 'falha no armazenamento')
      sendError(res, 503, 'Armazenamento indisponível')
    }
  },
)

storageRouter.post(
  '/storage/objects/:id/url',
  requireAuth,
  validate({ params: storageObjectIdParamsSchema }),
  async (req, res) => {
    const { id } = req.params as { id: string }
    const object = await prisma.storageObject.findUnique({ where: { id } })
    if (!object) return sendError(res, 404, 'Arquivo não encontrado')
    const mayReadMedicalExam =
      object.resourceType === 'MEDICAL_EXAM' &&
      (await canViewMedicalExam(object.resourceId, req.auth!.userId))
    if (object.ownerId !== req.auth!.userId && !mayReadMedicalExam)
      return sendError(res, 403, 'Sem acesso a este arquivo')

    const config = loadConfig()
    const signed = await signObjectUrl(
      object.id,
      config.STORAGE_SIGNED_URL_TTL_SECONDS,
      config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
    )
    res.json(signed)
  },
)

storageRouter.delete(
  '/storage/objects/:id',
  requireAuth,
  validate({ params: storageObjectIdParamsSchema }),
  async (req, res) => {
    const { id } = req.params as { id: string }
    const object = await prisma.storageObject.findUnique({ where: { id } })
    if (!object) return sendError(res, 404, 'Arquivo não encontrado')
    const mayManageMedicalExam =
      object.resourceType === 'MEDICAL_EXAM' &&
      (await canManageMedicalExam(object.resourceId, req.auth!.userId))
    if (object.ownerId !== req.auth!.userId && !mayManageMedicalExam)
      return sendError(res, 403, 'Sem acesso a este arquivo')

    const config = loadConfig()
    if (!isStorageConfigured(config)) return serviceUnavailable(res)
    try {
      await getStorageProvider(config).deleteObject(object.key)
    } catch (error) {
      logger.error({ err: error }, 'falha ao remover objeto')
      return sendError(res, 503, 'Armazenamento indisponível')
    }
    await prisma.storageObject.delete({ where: { id: object.id } })
    if (object.resourceType === 'MEDICAL_EXAM') {
      await prisma.exam.updateMany({ where: { id: object.resourceId }, data: { attachment: null } })
    }
    res.status(204).end()
  },
)

/** Entrega do arquivo: fora de /api para não herdar o prefixo privado do JWT. */
export const fileRouter = Router()

fileRouter.get(
  '/files/:id',
  validate({ params: storageObjectIdParamsSchema, query: storageFileQuerySchema }),
  async (req, res) => {
    const { id } = req.params as { id: string }
    const { token } = req.query as { token?: string }
    const object = await prisma.storageObject.findUnique({ where: { id } })
    if (!object) return sendError(res, 404, 'Arquivo não encontrado')

    const config = loadConfig()
    if (!isStorageConfigured(config)) return serviceUnavailable(res)
    await verifyObjectToken(token ?? '', object.id, config.STORAGE_URL_SECRET ?? config.JWT_SECRET)

    try {
      const stored = await getStorageProvider(config).getObject(object.key)
      res.setHeader('Content-Type', stored.contentType)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', 'inline')
      res.setHeader('Cache-Control', 'private, no-store')
      res.send(stored.body)
    } catch (error) {
      logger.error({ err: error }, 'falha ao ler objeto')
      sendError(res, 503, 'Armazenamento indisponível')
    }
  },
)
