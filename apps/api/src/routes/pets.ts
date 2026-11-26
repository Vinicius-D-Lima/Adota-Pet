import { petIdParamsSchema, petsQuerySchema } from '@adotapet/shared'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../auth.js'
import { currentUser, getProfile, presentPet, referenceUser } from '../context.js'
import { prisma } from '../db.js'
import { createMatchingStrategy, type MatchingAdopter, type MatchingStrategy } from '../matching.js'
import { petMedicalInclude } from '../medicalRecords.js'
import { positiveInt, sendError } from '../http.js'
import { validate } from '../validate.js'

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 100
const MAX_MATCH_LIMIT = 100
const SORTS = ['recent', 'name', 'distance']
const PETS_QUERY_PARAMS = ['search', 'page', 'limit', 'sort', 'species', 'size', 'sex', 'city']

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

    const where: Record<string, unknown> = { status: 'DISPONIVEL' }
    if (species) Object.assign(where, { species: { in: [species] } })
    if (size) Object.assign(where, { size: { in: [size] } })

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
    const { search, page, limit, sort = 'recent', ...filters } = req.query
    const details = Object.keys(req.query)
      .filter((key) => !PETS_QUERY_PARAMS.includes(key))
      .map((field) => ({ field, message: 'Parâmetro desconhecido' }))
    const pageNumber = positiveInt(page, 'page', details, 1)
    const limitNumber = positiveInt(limit, 'limit', details, DEFAULT_LIMIT)
    if (limitNumber > MAX_LIMIT)
      details.push({ field: 'limit', message: `limit máximo é ${MAX_LIMIT}` })
    if (!SORTS.includes(String(sort))) {
      details.push({ field: 'sort', message: `sort deve ser um de: ${SORTS.join(', ')}` })
    }
    if (details.length) return sendError(res, 400, 'Parâmetros de consulta inválidos', details)

    // Filtros exatos entram no banco; a busca textual e a ordenação são feitas em memória
    // (mesma semântica do json-server, que varre todos os valores do registro).
    const where = {}
    Object.assign(where, { status: { not: 'ADOTADO' } })
    for (const [key, value] of Object.entries(filters)) {
      const values = (Array.isArray(value) ? value : [value]).map(String)
      Object.assign(where, { [key]: { in: values } })
    }

    let pets = await prisma.pet.findMany({ where, include: petMedicalInclude })
    const term = Array.isArray(search)
      ? String(search[0] ?? '').toLowerCase()
      : typeof search === 'string'
        ? search.toLowerCase()
        : ''
    if (term) pets = pets.filter((pet) => matchesSearch(pet, term))

    const refUser = await referenceUser()

    if (sort === 'distance') {
      // A distância é calculada, não coluna: ordena depois de apresentar.
      const matches = pets
        .map((pet) => presentPet(pet, refUser))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      const start = (pageNumber - 1) * limitNumber
      return res.json({ data: matches.slice(start, start + limitNumber), total: matches.length })
    }

    pets =
      sort === 'name'
        ? [...pets].sort((a, b) => byCodeUnit(a.name, b.name))
        : [...pets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const start = (pageNumber - 1) * limitNumber
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

  return router
}

export const petsRouter = createPetsRouter()
