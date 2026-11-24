import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import multer from 'multer'
import {
  moderationReportsQuerySchema,
  reportIdParamsSchema,
  reportSchema,
  resolveReportSchema,
  type ReportFormData,
  type ResolveReportData,
} from '@adotapet/shared'
import { loadConfig } from '../config.js'
import { prisma } from '../db.js'
import { HttpError, list, sendError } from '../http.js'
import { recalculateOrganizationReputation } from '../reviews.js'
import {
  getStorageProvider,
  isStorageConfigured,
  signObjectUrl,
  STORAGE_SCOPES,
  validateUploadFiles,
} from '../storage.js'
import { validate } from '../validate.js'
import type {
  Report,
  ReportCategory,
  ReportStatus,
  ReportTargetType,
} from '../generated/prisma/client.js'

const DAILY_REPORT_LIMIT = 5
const DAY_MS = 24 * 60 * 60 * 1000
const OPEN_STATUSES: ReportStatus[] = ['ABERTA', 'EM_ANALISE']
const OFFICIAL_GUIDANCE =
  'Além de registrar na plataforma, acione também os canais oficiais: delegacia, Disque-Denúncia e órgão ambiental local. O AdotaPet não substitui a denúncia formal.'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: STORAGE_SCOPES.reportAttachment.maxFiles,
    fileSize: STORAGE_SCOPES.reportAttachment.maxBytesPerFile,
  },
})

function reportMultipart(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) return next()
  upload.array('files')(req, res, (error: unknown) => {
    if (!error) return next()
    const message =
      (error as { code?: string }).code === 'LIMIT_FILE_COUNT'
        ? `Máximo de ${STORAGE_SCOPES.reportAttachment.maxFiles} arquivos por operação`
        : (error as Error).message
    next(new HttpError(400, 'Upload inválido', [{ field: 'files', message }]))
  })
}

function requireModerator(req: Request): void {
  if (req.auth?.platformRole !== 'MODERADOR') {
    throw new HttpError(403, 'Esta operação é exclusiva da moderação da plataforma')
  }
}

async function ensureTargetExists(targetType: ReportTargetType, targetId: string): Promise<void> {
  let exists = false
  switch (targetType) {
    case 'USUARIO':
      exists = Boolean(
        await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }),
      )
      break
    case 'ORGANIZACAO':
      exists = Boolean(
        await prisma.guardianProfile.findUnique({
          where: { userId: targetId },
          select: { userId: true },
        }),
      )
      break
    case 'ADOCAO':
      exists = Boolean(
        await prisma.adoptionRequest.findUnique({ where: { id: targetId }, select: { id: true } }),
      )
      break
    case 'PET':
      exists = Boolean(
        await prisma.pet.findUnique({ where: { id: targetId }, select: { id: true } }),
      )
      break
    case 'AVALIACAO':
      exists = Boolean(
        await prisma.review.findUnique({ where: { id: targetId }, select: { id: true } }),
      )
      break
  }
  if (!exists) throw new HttpError(404, 'Alvo da denúncia não encontrado')
}

function needsOfficialGuidance(category: ReportCategory): boolean {
  return category === 'MAUS_TRATOS' || category === 'ABANDONO'
}

async function reportView(report: Report) {
  const objects = await prisma.storageObject.findMany({
    where: { resourceType: 'REPORT', resourceId: report.id },
    orderBy: { createdAt: 'asc' },
  })
  const config = loadConfig()
  const attachments = await Promise.all(
    objects.map(async (object) => ({
      id: object.id,
      contentType: object.contentType,
      sizeBytes: object.sizeBytes,
      ...(await signObjectUrl(
        object.id,
        config.STORAGE_SIGNED_URL_TTL_SECONDS,
        config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
      )),
    })),
  )

  // reporterId é deliberadamente omitido de todas as respostas. A identidade
  // continua persistida para auditoria, sem risco de chegar ao denunciado.
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    category: report.category,
    description: report.description,
    status: report.status,
    resolution: report.resolution,
    moderatorId: report.moderatorId,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    attachments,
    ...(needsOfficialGuidance(report.category) ? { officialGuidance: OFFICIAL_GUIDANCE } : {}),
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002'
}

export const reportsRouter = Router()

reportsRouter.post(
  '/reports',
  reportMultipart,
  validate({ body: reportSchema }),
  async (req, res) => {
    const reporterId = req.auth!.userId
    const body = req.body as ReportFormData
    const targetType = body.targetType as ReportTargetType
    const category = body.category as ReportCategory
    await ensureTargetExists(targetType, body.targetId)

    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    const prepared = files.length
      ? await validateUploadFiles(files, STORAGE_SCOPES.reportAttachment)
      : []
    const config = loadConfig()
    if (prepared.length && !isStorageConfigured(config)) {
      return sendError(res, 503, 'Armazenamento não configurado')
    }

    let report: Report
    try {
      report = await prisma.$transaction(async (tx) => {
        const since = new Date(Date.now() - DAY_MS)
        const recentCount = await tx.report.count({
          where: { reporterId, createdAt: { gte: since } },
        })
        if (recentCount >= DAILY_REPORT_LIMIT) {
          throw new HttpError(429, 'Limite de 5 denúncias a cada 24 horas atingido')
        }

        const duplicate = await tx.report.findFirst({
          where: { reporterId, targetType, targetId: body.targetId, status: { in: OPEN_STATUSES } },
          select: { id: true },
        })
        if (duplicate) throw new HttpError(409, 'Já existe uma denúncia aberta para este alvo')

        return tx.report.create({
          data: {
            reporterId,
            targetType,
            targetId: body.targetId,
            category,
            description: body.description,
          },
        })
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, 'Já existe uma denúncia aberta para este alvo')
      }
      throw error
    }

    if (prepared.length) {
      const provider = getStorageProvider(config)
      try {
        await provider.ensureBucket()
        for (const file of prepared) {
          const stored = await provider.putObject(file)
          await prisma.storageObject.create({
            data: {
              key: stored.key,
              contentType: stored.contentType,
              sizeBytes: stored.sizeBytes,
              resourceType: 'REPORT',
              resourceId: report.id,
              ownerId: reporterId,
            },
          })
        }
      } catch {
        const stored = await prisma.storageObject.findMany({
          where: { resourceType: 'REPORT', resourceId: report.id },
        })
        await Promise.allSettled(stored.map(({ key }) => provider.deleteObject(key)))
        await prisma.storageObject.deleteMany({
          where: { resourceType: 'REPORT', resourceId: report.id },
        })
        await prisma.report.delete({ where: { id: report.id } })
        throw new HttpError(503, 'Armazenamento indisponível')
      }
    }

    res.status(201).json(await reportView(report))
  },
)

reportsRouter.get('/me/reports', async (req, res) => {
  const reports = await prisma.report.findMany({
    where: { reporterId: req.auth!.userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  })
  res.json(list(await Promise.all(reports.map(reportView))))
})

reportsRouter.get(
  '/moderation/reports',
  validate({ query: moderationReportsQuerySchema }),
  async (req, res) => {
    requireModerator(req)
    const { status, category } = req.query as { status?: ReportStatus; category?: ReportCategory }
    const reports = await prisma.report.findMany({
      where: { ...(status ? { status } : {}), ...(category ? { category } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    })
    res.json(list(await Promise.all(reports.map(reportView))))
  },
)

reportsRouter.post(
  '/moderation/reports/:id/resolve',
  validate({ params: reportIdParamsSchema, body: resolveReportSchema }),
  async (req, res) => {
    requireModerator(req)
    const { id } = req.params as { id: string }
    const { status, resolution } = req.body as ResolveReportData
    const existing = await prisma.report.findUnique({ where: { id } })
    if (!existing) return sendError(res, 404, 'Denúncia não encontrada')
    if (!OPEN_STATUSES.includes(existing.status)) {
      return sendError(res, 409, 'Esta denúncia já foi resolvida')
    }

    const resolvedAt = new Date()
    const report = await prisma.$transaction(async (tx) => {
      if (status === 'PROCEDENTE' && existing.targetType === 'AVALIACAO') {
        const review = await tx.review.findUnique({ where: { id: existing.targetId } })
        if (review && !review.hiddenAt) {
          await tx.review.update({ where: { id: review.id }, data: { hiddenAt: resolvedAt } })
          if (review.revieweeOrganizationId) {
            await recalculateOrganizationReputation(tx, review.revieweeOrganizationId)
          }
        }
      }

      return tx.report.update({
        where: { id },
        data: {
          status,
          resolution,
          moderatorId: req.auth!.userId,
          resolvedAt,
        },
      })
    })

    res.json(await reportView(report))
  },
)
