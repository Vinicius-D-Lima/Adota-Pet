import { petIdParamsSchema, petsQuerySchema } from '@adotapet/shared'
import type { Request, Response } from 'express'
import { Router, type NextFunction } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import multer from 'multer'
import { z } from 'zod'
import { requireAuth } from '../auth.js'
import { currentUser, getProfile, presentPet, referenceUser, requireGuardian } from '../context.js'
import { loadConfig } from '../config.js'
import { prisma } from '../db.js'
import { haversineKm, HttpError, type FieldError, positiveInt, sendError } from '../http.js'
import { createMatchingStrategy, type MatchingAdopter, type MatchingStrategy } from '../matching.js'
import { petMedicalInclude, type PetWithMedicalRecord } from '../medicalRecords.js'
import { notifyMatchingSavedFilters } from '../savedFilterAlerts.js'
import {
  getStorageProvider,
  isStorageConfigured,
  signObjectUrl,
  STORAGE_SCOPES,
  validateUploadFiles,
} from '../storage.js'
import { validate } from '../validate.js'
import { createPetBodySchema, petGalleryBodySchema, updatePetBodySchema } from '../validation.js'

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 100
const MAX_MATCH_LIMIT = 100
const SORTS = ['recent', 'name', 'distance'] as const
const PETS_QUERY_PARAMS = [
  'search',
  'page',
  'limit',
  'sort',
  'species',
  'size',
  'sex',
  'city',
  'lat',
  'lng',
]

/** Filtros do ranking (MATCH-04/08): só pets disponíveis e limites explícitos. */
const matchesQuerySchema = z
  .object({
    species: z.string().min(1).optional(),
    size: z.string().min(1).optional(),
    limit: z.string().optional(),
  })
  .strict()

/** Busca textual como o json-server: substring em qualquer valor string (inclusive arrays). */
function matchesSearch(value: unknown, term: string): boolean {
  if (!value || !term) return false
  if (value instanceof Date) return value.toISOString().toLowerCase().includes(term)
  if (Array.isArray(value)) return value.some((item) => matchesSearch(item, term))
  if (typeof value === 'object')
    return Object.values(value).some((item) => matchesSearch(item, term))
  return String(value).toLowerCase().includes(term)
}

/** Comparação de string em ordem de código (a mesma do `orderBy` do json-server). */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** O perfil da conta é a única fonte de dados do adotante (MATCH-09). */
function adopterFromProfile(profile: Awaited<ReturnType<typeof getProfile>>): MatchingAdopter {
  return {
    activityLevel: profile.activityLevel,
    hasOutdoorArea: profile.hasOutdoorArea,
    dailyTime: profile.dailyTime,
    hasChildren: profile.hasChildren,
    hasOtherPets: profile.hasOtherPets,
    acceptsSpecialCare: profile.acceptsSpecialCare,
    experience: profile.experience,
  }
}

/** Perfil incompleto: 422 com a lista de campos faltantes (MATCH-05). */
function requireCompleteProfile(
  res: Parameters<typeof sendError>[0],
  profile: Awaited<ReturnType<typeof getProfile>>,
): boolean {
  if (profile.isComplete) return true
  sendError(
    res,
    422,
    'Complete seu perfil para receber recomendações',
    profile.missingFields.map((field) => ({ field, message: 'Campo obrigatório para matching' })),
  )
  return false
}

// ---------------------------------------------------------------------------
// CRUD de pets (#49)
// ---------------------------------------------------------------------------

interface PetWriteScope {
  userId: string
  /** Todas as organizações às quais o usuário está vinculado (membership ativa). */
  organizationIds: string[]
}

/**
 * Toda escrita exige membership ativa. `requireGuardian` sozinho não basta: um
 * usuário com papel GUARDIAN mas sem vínculo também precisa receber 403 (PET-06).
 */
async function requirePetWriteScope(req: Request, res: Response): Promise<PetWriteScope | null> {
  const viewer = await requireGuardian(req, res)
  if (!viewer) return null
  const memberships = await prisma.membership.findMany({
    where: { userId: viewer.id, status: 'ATIVO' },
    select: { organizationId: true },
  })
  if (!memberships.length) {
    sendError(res, 403, 'Você não pertence a uma organização')
    return null
  }
  return {
    userId: viewer.id,
    organizationIds: memberships.map(({ organizationId }) => organizationId),
  }
}

/** Pet inexistente é 404; pet de outra organização é 403 (PET-05/PET-07). */
async function scopedPet(
  req: Request,
  res: Response,
  scope: PetWriteScope,
): Promise<PetWithMedicalRecord | null> {
  const pet = await prisma.pet.findUnique({
    where: { id: String(req.params.id) },
    include: petMedicalInclude,
  })
  if (!pet) {
    sendError(res, 404, 'Pet não encontrado')
    return null
  }
  if (!scope.organizationIds.includes(pet.organizationId)) {
    sendError(res, 403, 'Você não tem permissão para alterar este pet')
    return null
  }
  return pet
}

/** Slug legível e único para o id do pet (o schema não tem default). */
async function newPetId(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'pet'
  let id = base
  let suffix = 2
  while (await prisma.pet.findUnique({ where: { id }, select: { id: true } })) {
    id = `${base}-${suffix++}`
  }
  return id
}

const coordinate = (
  value: string | undefined,
  field: 'lat' | 'lng',
  min: number,
  max: number,
  details: FieldError[],
): number | undefined => {
  if (value === undefined) return undefined
  const number = Number(value)
  if (!value.trim() || !Number.isFinite(number) || number < min || number > max) {
    details.push({ field, message: `${field} deve ser um número entre ${min} e ${max}` })
    return undefined
  }
  return number
}

/** Distância calculada a partir das coordenadas da própria requisição (PET-03). */
function presentWithDistance(pet: PetWithMedicalRecord, lat: number, lng: number) {
  const base = presentPet(pet, null)
  if (typeof pet.lat !== 'number' || typeof pet.lng !== 'number') {
    return { ...base, distanceKm: null, distance: null }
  }
  const distanceKm = Math.round(haversineKm(lat, lng, pet.lat, pet.lng) * 10) / 10
  return { ...base, distanceKm, distance: `${String(distanceKm).replace('.', ',')} km` }
}

/** Multipart com o mesmo teto do módulo de armazenamento (#94/#49). */
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

export function createPetsRouter(strategy: MatchingStrategy = createMatchingStrategy()): Router {
  const router = Router()

  router.get('/me/matches', validate({ query: matchesQuerySchema }), async (req, res) => {
    const { id: userId, user } = await currentUser(req)
    const profile = await getProfile(userId)
    if (!requireCompleteProfile(res, profile)) return

    const { species, size, limit } = req.query as z.infer<typeof matchesQuerySchema>
    const details: Array<{ field: string; message: string }> = []
    const limitNumber = positiveInt(limit, 'limit', details, DEFAULT_LIMIT)
    if (limitNumber > MAX_MATCH_LIMIT)
      details.push({ field: 'limit', message: `limit máximo é ${MAX_MATCH_LIMIT}` })
    if (details.length) return sendError(res, 400, 'Parâmetros de consulta inválidos', details)

    const where: Prisma.PetWhereInput = { status: 'DISPONIVEL' }
    if (species) where.species = { in: [species] }
    if (size) where.size = { in: [size] }

    const pets = await prisma.pet.findMany({
      where,
      include: petMedicalInclude,
    })
    const ranked = pets
      .map((pet) => {
        const presented = presentPet(pet, user)
        return {
          ...presented,
          matching: strategy.calculate(presented, adopterFromProfile(profile)),
        }
      })
      .sort((a, b) => (b.matching?.score ?? 0) - (a.matching?.score ?? 0) || byCodeUnit(a.id, b.id))

    res.json({ data: ranked.slice(0, limitNumber), total: ranked.length })
  })

  // MATCH-09: compatibilidade usa sempre o perfil do usuário autenticado.Esta
  // rota está fora do prefixo /me, então o JWT é exigido explicitamente.
  router.get(
    '/pets/:id/compatibility',
    requireAuth,
    validate({ params: petIdParamsSchema }),
    async (req, res) => {
      const { id: userId, user } = await currentUser(req)
      const profile = await getProfile(userId)
      if (!requireCompleteProfile(res, profile)) return

      const pet = await prisma.pet.findUnique({
        where: { id: String(req.params.id) },
        include: petMedicalInclude,
      })
      if (!pet) return sendError(res, 404, 'Pet não encontrado')
      res.json(strategy.calculate(presentPet(pet, user), adopterFromProfile(profile)))
    },
  )

  router.get('/pets', validate({ query: petsQuerySchema }), async (req, res) => {
    const query = req.query as z.infer<typeof petsQuerySchema>
    const { search, page, limit, sort = 'recent', species, size, sex, city, lat, lng } = query
    const details: FieldError[] = Object.keys(query)
      .filter((key) => !PETS_QUERY_PARAMS.includes(key))
      .map((field) => ({ field, message: 'Parâmetro desconhecido' }))
    const pageNumber = positiveInt(page, 'page', details, 1)
    const limitNumber = positiveInt(limit, 'limit', details, DEFAULT_LIMIT)
    if (limitNumber > MAX_LIMIT)
      details.push({ field: 'limit', message: `limit máximo é ${MAX_LIMIT}` })
    if (!(SORTS as readonly string[]).includes(sort)) {
      details.push({ field: 'sort', message: `sort deve ser um de: ${SORTS.join(', ')}` })
    }

    let fromLat: number | undefined
    let fromLng: number | undefined
    if (sort === 'distance') {
      if (lat === undefined)
        details.push({ field: 'lat', message: 'lat é obrigatório para sort=distance' })
      if (lng === undefined)
        details.push({ field: 'lng', message: 'lng é obrigatório para sort=distance' })
      fromLat = coordinate(lat, 'lat', -90, 90, details)
      fromLng = coordinate(lng, 'lng', -180, 180, details)
    }
    if (details.length) return sendError(res, 400, 'Parâmetros de consulta inválidos', details)

    // Só disponíveis na listagem pública: adotados e arquivados continuam
    // acessíveis pelo id (PET-04). Filtros exatos vão para o banco, de forma
    // parametrizada; busca textual e distância são calculadas em memória.
    const where: Prisma.PetWhereInput = { status: 'DISPONIVEL' }
    if (species) where.species = species
    if (sex) where.sex = sex
    if (city) where.city = city
    if (size) where.size = { in: Array.isArray(size) ? size : [size] }

    let pets = await prisma.pet.findMany({ where, include: petMedicalInclude })
    const term = search?.toLowerCase() ?? ''
    if (term) pets = pets.filter((pet) => matchesSearch(pet, term))

    const start = (pageNumber - 1) * limitNumber
    if (sort === 'distance') {
      if (fromLat === undefined || fromLng === undefined) {
        return sendError(res, 400, 'Parâmetros de consulta inválidos')
      }
      const ranked = pets
        .map((pet) => presentWithDistance(pet, fromLat as number, fromLng as number))
        .sort(
          (a, b) =>
            (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byCodeUnit(a.id, b.id),
        )
      return res.json({ data: ranked.slice(start, start + limitNumber), total: ranked.length })
    }

    pets = [...pets].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || byCodeUnit(a.id, b.id),
    )
    const refUser = await referenceUser()
    res.json({
      data: pets.slice(start, start + limitNumber).map((pet) => presentPet(pet, refUser)),
      total: pets.length,
    })
  })

  router.get('/pets/:id', validate({ params: petIdParamsSchema }), async (req, res) => {
    const pet = await prisma.pet.findUnique({
      where: { id: String(req.params.id) },
      include: petMedicalInclude,
    })
    if (!pet) return sendError(res, 404, 'Pet não encontrado')
    res.json(presentPet(pet, await referenceUser()))
  })

  /** Publicação: organizationId e status vêm do servidor, nunca do corpo (PET-08). */
  router.post('/pets', requireAuth, validate({ body: createPetBodySchema }), async (req, res) => {
    const scope = await requirePetWriteScope(req, res)
    if (!scope) return
    const body = req.body as z.infer<typeof createPetBodySchema>
    const organizationId = scope.organizationIds[0]
    const user = await prisma.user.findUnique({
      where: { id: scope.userId },
      select: { lat: true, lng: true },
    })
    const id = await newPetId(body.name)
    const data: Prisma.PetUncheckedCreateInput = {
      ...body,
      id,
      ageLabel: `${body.age} ${body.age === 1 ? 'ano' : 'anos'}`,
      gallery: [body.image],
      organizationId,
      lat: body.lat ?? user?.lat ?? null,
      lng: body.lng ?? user?.lng ?? null,
      status: 'DISPONIVEL',
      createdAt: new Date(),
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.pet.create({ data })
      await tx.medicalRecord.create({
        data: {
          petId: row.id,
          createdById: scope.userId,
          updatedById: scope.userId,
          neutering: {
            create: { done: false, createdById: scope.userId, updatedById: scope.userId },
          },
        },
      })
      // #31/FIL-03: o alerta entra na mesma transação da publicação.
      await notifyMatchingSavedFilters(
        {
          id: row.id,
          name: row.name,
          species: row.species,
          size: row.size,
          sex: row.sex,
          city: row.city,
          organizationId: row.organizationId,
        },
        { tx },
      )
      return tx.pet.findUniqueOrThrow({ where: { id: row.id }, include: petMedicalInclude })
    })
    res.status(201).json(presentPet(created, await referenceUser()))
  })

  /** Edição e reabertura: `status: DISPONIVEL` dispara os alertas salvos (#31). */
  router.put(
    '/pets/:id',
    requireAuth,
    validate({ params: petIdParamsSchema, body: updatePetBodySchema }),
    async (req, res) => {
      const scope = await requirePetWriteScope(req, res)
      if (!scope) return
      const existing = await scopedPet(req, res, scope)
      if (!existing) return

      const { status, image, ...fields } = req.body as z.infer<typeof updatePetBodySchema>
      const data: Prisma.PetUncheckedUpdateInput = { ...fields }
      if (fields.age !== undefined) {
        data.ageLabel = `${fields.age} ${fields.age === 1 ? 'ano' : 'anos'}`
      }
      if (image !== undefined) {
        data.image = image
        data.gallery = [image, ...existing.gallery.filter((item) => item !== image)]
      }
      const reopening = status === 'DISPONIVEL' && existing.status !== 'DISPONIVEL'
      if (reopening) data.status = 'DISPONIVEL'

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.pet.update({ where: { id: existing.id }, data })
        if (reopening) {
          await notifyMatchingSavedFilters(
            {
              id: row.id,
              name: row.name,
              species: row.species,
              size: row.size,
              sex: row.sex,
              city: row.city,
              organizationId: row.organizationId,
            },
            { tx },
          )
        }
        return tx.pet.findUniqueOrThrow({ where: { id: row.id }, include: petMedicalInclude })
      })
      res.json(presentPet(updated, await referenceUser()))
    },
  )

  /** Arquivar preserva solicitações, adoções e favoritos (PET-11). */
  router.post(
    '/pets/:id/archive',
    requireAuth,
    validate({ params: petIdParamsSchema }),
    async (req, res) => {
      const scope = await requirePetWriteScope(req, res)
      if (!scope) return
      const pet = await scopedPet(req, res, scope)
      if (!pet) return
      const updated = await prisma.pet.update({
        where: { id: pet.id },
        data: { status: 'ARQUIVADO' },
        include: petMedicalInclude,
      })
      res.json(presentPet(updated, await referenceUser()))
    },
  )

  /** Reordena a galeria e escolhe a capa (PET-12). */
  router.put(
    '/pets/:id/gallery',
    requireAuth,
    validate({ params: petIdParamsSchema, body: petGalleryBodySchema }),
    async (req, res) => {
      const scope = await requirePetWriteScope(req, res)
      if (!scope) return
      const pet = await scopedPet(req, res, scope)
      if (!pet) return
      const { gallery, image } = req.body as z.infer<typeof petGalleryBodySchema>
      if (!gallery.includes(image)) {
        return sendError(res, 400, 'Validação falhou', [
          { field: 'image', message: 'A capa precisa estar na galeria' },
        ])
      }
      const updated = await prisma.pet.update({
        where: { id: pet.id },
        data: { gallery, image },
        include: petMedicalInclude,
      })
      res.json(presentPet(updated, await referenceUser()))
    },
  )

  /** Fotos do pet: validação por conteúdo/tamanho/quantidade (#49/#94). */
  router.post(
    '/pets/:id/photos',
    requireAuth,
    validate({ params: petIdParamsSchema }),
    multipart,
    async (req, res) => {
      const scope = await requirePetWriteScope(req, res)
      if (!scope) return
      const pet = await scopedPet(req, res, scope)
      if (!pet) return
      const config = loadConfig()
      if (!isStorageConfigured(config)) {
        return sendError(res, 503, 'Armazenamento não configurado')
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? []
      const prepared = await validateUploadFiles(files, STORAGE_SCOPES.petPhoto)
      const provider = getStorageProvider(config)
      await provider.ensureBucket()

      const urls: string[] = []
      for (const file of prepared) {
        const stored = await provider.putObject(file)
        const record = await prisma.storageObject.create({
          data: {
            key: stored.key,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            resourceType: 'PET',
            resourceId: pet.id,
            ownerId: scope.userId,
          },
        })
        const signed = await signObjectUrl(
          record.id,
          config.STORAGE_SIGNED_URL_TTL_SECONDS,
          config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
        )
        urls.push(signed.url)
      }

      const gallery = [...pet.gallery, ...urls]
      const updated = await prisma.pet.update({
        where: { id: pet.id },
        data: { gallery, image: urls[0] ?? pet.image },
        include: petMedicalInclude,
      })
      res.status(201).json(presentPet(updated, await referenceUser()))
    },
  )

  return router
}

export const petsRouter = createPetsRouter()
