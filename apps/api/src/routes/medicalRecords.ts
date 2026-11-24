import {
  examInputSchema,
  healthConditionInputSchema,
  medicalRecordItemParamsSchema,
  medicalRecordPetParamsSchema,
  neuteringInputSchema,
  vaccinationInputSchema,
  type ExamInput,
  type HealthConditionInput,
  type NeuteringInput,
  type VaccinationInput,
} from '@adotapet/shared'
import { Router } from 'express'
import { optionalAuth, requireAuth } from '../auth.js'
import { prisma } from '../db.js'
import { sendError } from '../http.js'
import {
  canViewCompleteMedicalRecord,
  completeMedicalRecord,
  ensureMedicalRecord,
  medicalRecordRelations,
  publicMedicalRecord,
  requirePetOrganizationMember,
} from '../medicalRecords.js'
import { deleteStorageObjectsForResource } from '../storage.js'
import { validate } from '../validate.js'

export const medicalRecordsRouter = Router()

const params = { params: medicalRecordPetParamsSchema }
const itemParams = { params: medicalRecordItemParamsSchema }

medicalRecordsRouter.get(
  '/pets/:petId/medical-record',
  optionalAuth,
  validate(params),
  async (req, res) => {
    const { petId } = req.params as { petId: string }
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      include: { medicalRecord: { include: medicalRecordRelations } },
    })
    if (!pet) return sendError(res, 404, 'Pet não encontrado')
    const full = req.user && (await canViewCompleteMedicalRecord(petId, req.user.id))
    res.json(
      full
        ? await completeMedicalRecord(petId, pet.medicalRecord)
        : publicMedicalRecord(petId, pet.medicalRecord),
    )
  },
)

medicalRecordsRouter.put(
  '/pets/:petId/medical-record/neutering',
  requireAuth,
  validate({ ...params, body: neuteringInputSchema }),
  async (req, res) => {
    const { petId } = req.params as { petId: string }
    const actorId = req.user!.id
    await requirePetOrganizationMember(petId, actorId)
    const record = await ensureMedicalRecord(petId, actorId)
    const body = req.body as NeuteringInput
    const row = await prisma.neutering.upsert({
      where: { medicalRecordId: record.id },
      create: {
        medicalRecordId: record.id,
        done: body.done,
        date: body.date ? new Date(body.date) : null,
        createdById: actorId,
        updatedById: actorId,
      },
      update: {
        done: body.done,
        date: body.date ? new Date(body.date) : null,
        updatedById: actorId,
      },
    })
    await prisma.medicalRecord.update({ where: { id: record.id }, data: { updatedById: actorId } })
    res.json(row)
  },
)

medicalRecordsRouter.post(
  '/pets/:petId/medical-record/vaccinations',
  requireAuth,
  validate({ ...params, body: vaccinationInputSchema }),
  async (req, res) => {
    const { petId } = req.params as { petId: string }
    const actorId = req.user!.id
    await requirePetOrganizationMember(petId, actorId)
    const record = await ensureMedicalRecord(petId, actorId)
    const body = req.body as VaccinationInput
    const row = await prisma.vaccination.create({
      data: {
        medicalRecordId: record.id,
        ...body,
        appliedAt: new Date(body.appliedAt),
        nextDoseAt: body.nextDoseAt ? new Date(body.nextDoseAt) : null,
        batch: body.batch ?? null,
        veterinarian: body.veterinarian ?? null,
        createdById: actorId,
        updatedById: actorId,
      },
    })
    res.status(201).json(row)
  },
)

medicalRecordsRouter.put(
  '/pets/:petId/medical-record/vaccinations/:itemId',
  requireAuth,
  validate({ ...itemParams, body: vaccinationInputSchema }),
  async (req, res) => {
    const { petId, itemId } = req.params as { petId: string; itemId: string }
    const actorId = req.user!.id
    await requirePetOrganizationMember(petId, actorId)
    const existing = await prisma.vaccination.findUnique({
      where: { id: itemId },
      include: { medicalRecord: { select: { petId: true } } },
    })
    if (!existing || existing.medicalRecord.petId !== petId)
      return sendError(res, 404, 'Vacina não encontrada neste prontuário')
    const body = req.body as VaccinationInput
    const row = await prisma.vaccination.update({
      where: { id: itemId },
      data: {
        ...body,
        appliedAt: new Date(body.appliedAt),
        nextDoseAt: body.nextDoseAt ? new Date(body.nextDoseAt) : null,
        batch: body.batch ?? null,
        veterinarian: body.veterinarian ?? null,
        updatedById: actorId,
      },
    })
    res.json(row)
  },
)

medicalRecordsRouter.delete(
  '/pets/:petId/medical-record/vaccinations/:itemId',
  requireAuth,
  validate(itemParams),
  async (req, res) => {
    const { petId, itemId } = req.params as { petId: string; itemId: string }
    await requirePetOrganizationMember(petId, req.user!.id)
    const deleted = await prisma.vaccination.deleteMany({
      where: { id: itemId, medicalRecord: { petId } },
    })
    if (!deleted.count) return sendError(res, 404, 'Vacina não encontrada neste prontuário')
    res.status(204).end()
  },
)

medicalRecordsRouter.post(
  '/pets/:petId/medical-record/conditions',
  requireAuth,
  validate({ ...params, body: healthConditionInputSchema }),
  async (req, res) => {
    const { petId } = req.params as { petId: string }
    const actorId = req.user!.id
    await requirePetOrganizationMember(petId, actorId)
    const record = await ensureMedicalRecord(petId, actorId)
    const body = req.body as HealthConditionInput
    const row = await prisma.healthCondition.create({
      data: { medicalRecordId: record.id, ...body, createdById: actorId, updatedById: actorId },
    })
    res.status(201).json(row)
  },
)

medicalRecordsRouter.put(
  '/pets/:petId/medical-record/conditions/:itemId',
  requireAuth,
  validate({ ...itemParams, body: healthConditionInputSchema }),
  async (req, res) => {
    const { petId, itemId } = req.params as { petId: string; itemId: string }
    const actorId = req.user!.id
    await requirePetOrganizationMember(petId, actorId)
    const existing = await prisma.healthCondition.findUnique({
      where: { id: itemId },
      include: { medicalRecord: { select: { petId: true } } },
    })
    if (!existing || existing.medicalRecord.petId !== petId)
      return sendError(res, 404, 'Condição não encontrada neste prontuário')
    const row = await prisma.healthCondition.update({
      where: { id: itemId },
      data: { ...(req.body as HealthConditionInput), updatedById: actorId },
    })
    res.json(row)
  },
)

medicalRecordsRouter.delete(
  '/pets/:petId/medical-record/conditions/:itemId',
  requireAuth,
  validate(itemParams),
  async (req, res) => {
    const { petId, itemId } = req.params as { petId: string; itemId: string }
    await requirePetOrganizationMember(petId, req.user!.id)
    const deleted = await prisma.healthCondition.deleteMany({
      where: { id: itemId, medicalRecord: { petId } },
    })
    if (!deleted.count) return sendError(res, 404, 'Condição não encontrada neste prontuário')
    res.status(204).end()
  },
)

medicalRecordsRouter.post(
  '/pets/:petId/medical-record/exams',
  requireAuth,
  validate({ ...params, body: examInputSchema }),
  async (req, res) => {
    const { petId } = req.params as { petId: string }
    const actorId = req.user!.id
    await requirePetOrganizationMember(petId, actorId)
    const record = await ensureMedicalRecord(petId, actorId)
    const body = req.body as ExamInput
    const row = await prisma.exam.create({
      data: {
        medicalRecordId: record.id,
        type: body.type,
        date: new Date(body.date),
        result: body.result,
        createdById: actorId,
        updatedById: actorId,
      },
    })
    res.status(201).json(row)
  },
)

medicalRecordsRouter.put(
  '/pets/:petId/medical-record/exams/:itemId',
  requireAuth,
  validate({ ...itemParams, body: examInputSchema }),
  async (req, res) => {
    const { petId, itemId } = req.params as { petId: string; itemId: string }
    const actorId = req.user!.id
    await requirePetOrganizationMember(petId, actorId)
    const existing = await prisma.exam.findUnique({
      where: { id: itemId },
      include: { medicalRecord: { select: { petId: true } } },
    })
    if (!existing || existing.medicalRecord.petId !== petId)
      return sendError(res, 404, 'Exame não encontrado neste prontuário')
    const body = req.body as ExamInput
    const row = await prisma.exam.update({
      where: { id: itemId },
      data: {
        type: body.type,
        date: new Date(body.date),
        result: body.result,
        updatedById: actorId,
      },
    })
    res.json(row)
  },
)

medicalRecordsRouter.delete(
  '/pets/:petId/medical-record/exams/:itemId',
  requireAuth,
  validate(itemParams),
  async (req, res) => {
    const { petId, itemId } = req.params as { petId: string; itemId: string }
    await requirePetOrganizationMember(petId, req.user!.id)
    const exam = await prisma.exam.findUnique({
      where: { id: itemId },
      include: { medicalRecord: { select: { petId: true } } },
    })
    if (!exam || exam.medicalRecord.petId !== petId)
      return sendError(res, 404, 'Exame não encontrado neste prontuário')
    await deleteStorageObjectsForResource('MEDICAL_EXAM', exam.id)
    await prisma.exam.delete({ where: { id: exam.id } })
    res.status(204).end()
  },
)
