import { requestStatusCodeOf } from '@adotapet/shared'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import { Prisma } from './generated/prisma/client.js'
import { HttpError } from './http.js'
import { signObjectUrl } from './storage.js'

export const medicalRecordRelations = {
  vaccinations: { orderBy: [{ appliedAt: 'desc' }, { id: 'asc' }] },
  neutering: true,
  healthConditions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  exams: { orderBy: [{ date: 'desc' }, { id: 'asc' }] },
} satisfies Prisma.MedicalRecordInclude

export const petMedicalInclude = {
  organizationEntity: true,
  medicalRecord: { include: medicalRecordRelations },
} satisfies Prisma.PetInclude

export type PetWithMedicalRecord = Prisma.PetGetPayload<{ include: typeof petMedicalInclude }>
export type CompleteMedicalRecord = NonNullable<PetWithMedicalRecord['medicalRecord']>

interface MedicalStatusSource {
  vaccinations: Array<{ nextDoseAt: Date | null }>
  neutering: { done: boolean } | null
  healthConditions: Array<{
    type: 'CRONICA' | 'EM_TRATAMENTO' | 'TRATADA'
    careRequired: boolean
  }>
}

export function derivePetHealth(record: MedicalStatusSource | null, now = new Date()) {
  const vaccinations = record?.vaccinations ?? []
  return {
    vaccinated:
      vaccinations.length > 0 &&
      vaccinations.every(({ nextDoseAt }) => nextDoseAt === null || nextDoseAt >= now),
    neutered: record?.neutering?.done ?? false,
    specialCare:
      record?.healthConditions.some(
        ({ type, careRequired }) =>
          careRequired && (type === 'CRONICA' || type === 'EM_TRATAMENTO'),
      ) ?? false,
  }
}

export async function ensureMedicalRecord(petId: string, actorId: string) {
  return prisma.medicalRecord.upsert({
    where: { petId },
    create: {
      petId,
      createdById: actorId,
      updatedById: actorId,
      neutering: {
        create: { done: false, createdById: actorId, updatedById: actorId },
      },
    },
    update: {},
    include: medicalRecordRelations,
  })
}

export async function requirePetOrganizationMember(petId: string, userId: string) {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { organizationId: true },
  })
  if (!pet) throw new HttpError(404, 'Pet não encontrado')
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: pet.organizationId } },
  })
  if (!membership || membership.status !== 'ATIVO') {
    throw new HttpError(403, 'Somente membros da organização responsável podem editar o prontuário')
  }
  return pet
}

const ACTIVE_REQUEST_STATUSES = new Set([
  'ENVIADA',
  'ANALISE_QUESTIONARIO',
  'ENTREVISTA',
  'VISITA_DOMICILIAR',
  'DECISAO_FINAL',
  'APROVADA',
])

export async function canViewCompleteMedicalRecord(petId: string, userId: string) {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { organizationId: true },
  })
  if (!pet) return false
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: pet.organizationId } },
  })
  if (membership?.status === 'ATIVO') return true

  const requests = await prisma.adoptionRequest.findMany({
    where: { petId, userId },
    select: { status: true },
  })
  return requests.some(({ status }) => {
    const code = requestStatusCodeOf(status) ?? status
    return ACTIVE_REQUEST_STATUSES.has(code)
  })
}

export async function canViewMedicalExam(examId: string, userId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { medicalRecord: { select: { petId: true } } },
  })
  return exam ? canViewCompleteMedicalRecord(exam.medicalRecord.petId, userId) : false
}

export async function canManageMedicalExam(examId: string, userId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { medicalRecord: { select: { petId: true } } },
  })
  if (!exam) return false
  try {
    await requirePetOrganizationMember(exam.medicalRecord.petId, userId)
    return true
  } catch {
    return false
  }
}

const audit = (item: {
  createdAt: Date
  createdById: string
  updatedAt: Date
  updatedById: string
}) => ({
  createdAt: item.createdAt,
  createdById: item.createdById,
  updatedAt: item.updatedAt,
  updatedById: item.updatedById,
})

export function publicMedicalRecord(petId: string, record: CompleteMedicalRecord | null) {
  return {
    petId,
    ...derivePetHealth(record),
    vaccinations: (record?.vaccinations ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      appliedAt: item.appliedAt,
      nextDoseAt: item.nextDoseAt,
      batch: item.batch,
      veterinarian: item.veterinarian,
    })),
    neutering: record?.neutering
      ? { done: record.neutering.done, date: record.neutering.date }
      : { done: false, date: null },
    healthConditions: (record?.healthConditions ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      careRequired: item.careRequired,
    })),
  }
}

export async function completeMedicalRecord(petId: string, record: CompleteMedicalRecord | null) {
  const base = publicMedicalRecord(petId, record)
  if (!record) return { ...base, exams: [], complete: true }
  const config = loadConfig()
  const exams = await Promise.all(
    record.exams.map(async (item) => {
      let attachment: { id: string; url: string; expiresAt: string } | null = null
      if (item.attachment) {
        const object = await prisma.storageObject.findFirst({
          where: { id: item.attachment, resourceType: 'MEDICAL_EXAM', resourceId: item.id },
        })
        if (object) {
          const signed = await signObjectUrl(
            object.id,
            config.STORAGE_SIGNED_URL_TTL_SECONDS,
            config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
          )
          attachment = { id: object.id, ...signed }
        }
      }
      return { ...item, attachment, ...audit(item) }
    }),
  )
  return {
    ...base,
    complete: true,
    vaccinations: record.vaccinations.map((item) => ({ ...item, ...audit(item) })),
    neutering: record.neutering
      ? { ...record.neutering, ...audit(record.neutering) }
      : base.neutering,
    healthConditions: record.healthConditions.map((item) => ({ ...item, ...audit(item) })),
    exams,
  }
}
