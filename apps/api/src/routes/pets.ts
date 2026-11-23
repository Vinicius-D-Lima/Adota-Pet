import { petIdParamsSchema, petsQuerySchema } from '@adotapet/shared'
import { Router } from 'express'
import { calculateRequestMatching, type MatchingAdopter } from '../matching.js'
import { currentUser, getProfile, presentPet, referenceUser } from '../context.js'
import { prisma } from '../db.js'
import { positiveInt, sendError } from '../http.js'
import { validate } from '../validate.js'

export const petsRouter = Router()

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 100
const SORTS = ['recent', 'name', 'distance']
const PETS_QUERY_PARAMS = ['search', 'page', 'limit', 'sort', 'species', 'size', 'sex', 'city']

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

petsRouter.get('/me/matches', async (req, res) => {
  const { id: userId, user } = await currentUser(req)
  const profile = await getProfile(userId)
  if (!profile.isComplete) {
    return sendError(
      res,
      409,
      'Complete seu perfil para receber recomendações',
      profile.missingFields.map((field) => ({ field, message: 'Campo obrigatório para matching' })),
    )
  }
  const adopterProfile: MatchingAdopter = {
    activityLevel: profile.activityLevel,
    hasOutdoorArea: profile.hasOutdoorArea,
    dailyTime: profile.dailyTime,
    hasChildren: profile.hasChildren,
    hasOtherPets: profile.hasOtherPets,
    acceptsSpecialCare: profile.acceptsSpecialCare,
    experience: profile.experience,
  }

  const pets = await prisma.pet.findMany({
    where: { status: { not: 'ADOTADO' } },
  })
  const data = pets
    .map((pet) => ({
      ...presentPet(pet, user),
      matching: calculateRequestMatching(pet, adopterProfile),
    }))
    .sort((a, b) => (b.matching?.score ?? 0) - (a.matching?.score ?? 0) || byCodeUnit(a.id, b.id))

  res.json({ data, total: data.length })
})

petsRouter.get('/pets', validate({ query: petsQuerySchema }), async (req, res) => {
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

  let pets = await prisma.pet.findMany({ where })
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

petsRouter.get('/pets/:id', validate({ params: petIdParamsSchema }), async (req, res) => {
  const pet = await prisma.pet.findUnique({ where: { id: String(req.params.id) } })
  if (!pet) return sendError(res, 404, 'Pet não encontrado')
  res.json(presentPet(pet, await referenceUser()))
})
