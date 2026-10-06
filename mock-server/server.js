import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jsonServer from 'json-server'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SEED_PATH = path.join(here, 'db.seed.json')
export const DB_PATH = path.join(here, 'db.json')

const DEFAULT_DEMO_USER_ID = process.env.DEMO_USER_ID ?? 'demo'
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 100
const ACTIVE_STATUSES = ['Enviada', 'Em análise', 'Aprovada']
const CANCELLABLE_STATUSES = ['Enviada', 'Em análise']
const SORTS = ['recent', 'name', 'distance']
const PETS_QUERY_PARAMS = ['search', 'page', 'limit', 'sort', 'species', 'size', 'sex', 'city']
const PROFILE_ENUMS = {
  housing: ['Apartamento', 'Casa', 'Chácara ou sítio'],
  dailyTime: ['Até 1 hora', '2 a 3 horas', 'Mais de 3 horas'],
  activityLevel: ['Tranquilo', 'Moderado', 'Ativo'],
  experience: ['Primeiro pet', 'Já tive pets', 'Tenho bastante experiência'],
  preferredSpecies: ['Sem preferência', 'Cachorro', 'Gato'],
  preferredSize: ['Sem preferência', 'Pequeno', 'Pequeno ou médio', 'Médio ou grande'],
}
const PROFILE_BOOLEANS = ['hasOutdoorArea', 'hasChildren', 'hasOtherPets', 'acceptsSpecialCare']
const PROFILE_DIGITS = ['cpf', 'phone', 'zipCode']
const PROFILE_FIELDS = [
  'name',
  'cpf',
  'birthDate',
  'email',
  'phone',
  'zipCode',
  'address',
  'housing',
  'hasOutdoorArea',
  'dailyTime',
  'activityLevel',
  'hasChildren',
  'hasOtherPets',
  'experience',
  'acceptsSpecialCare',
  'preferredSpecies',
  'preferredSize',
]
const GUARDIAN_TYPES = ['INDIVIDUAL', 'ORGANIZATION']
const GUARDIAN_FIELDS = [
  'guardianType',
  'displayName',
  'legalName',
  'document',
  'email',
  'phone',
  'zipCode',
  'address',
  'city',
  'description',
  'acceptsTerms',
]
const GUARDIAN_DIGITS = ['document', 'phone', 'zipCode']
const ORGANIZATION_REQUEST_TRANSITIONS = {
  EM_ANALISE: 'Em análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
}
const ORGANIZATION_PET_FIELDS = [
  'name',
  'species',
  'breed',
  'age',
  'size',
  'sex',
  'city',
  'image',
  'summary',
  'description',
  'traits',
  'energy',
  'space',
  'children',
  'otherPets',
  'specialCare',
  'vaccinated',
  'neutered',
]

const digitsOnly = (value) => value.replace(/\D/g, '')

function isValidCpf(value) {
  const cpf = digitsOnly(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calculateDigit = (length) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
}

function isValidCnpj(value) {
  const cnpj = digitsOnly(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const digit = (base, weights) => {
    const sum = base
      .split('')
      .reduce((total, number, index) => total + Number(number) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = digit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = digit(`${cnpj.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(cnpj[12]) && second === Number(cnpj[13])
}

function isAdult(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const birthDate = new Date(year, month - 1, day)
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  )
    return false
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day))
    age -= 1
  return age >= 18
}

/** Mesmas regras do profileSchema do frontend: [validação, mensagem]. */
const PROFILE_RULES = {
  name: [(v) => v.trim().length >= 3, 'Informe seu nome completo.'],
  cpf: [isValidCpf, 'Informe um CPF válido.'],
  birthDate: [isAdult, 'É necessário ter pelo menos 18 anos.'],
  email: [(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), 'Informe um e-mail válido.'],
  phone: [(v) => /^\d{10,11}$/.test(digitsOnly(v)), 'Informe um telefone com DDD.'],
  zipCode: [(v) => /^\d{8}$/.test(digitsOnly(v)), 'Informe um CEP válido.'],
  address: [(v) => v.trim().length >= 5, 'Informe seu endereço.'],
}

/** Retorna a mensagem de erro do campo ou null quando o valor é válido. */
function profileFieldError(key, value) {
  if (PROFILE_BOOLEANS.includes(key)) {
    return typeof value === 'boolean' ? null : `${key} deve ser verdadeiro ou falso`
  }
  if (typeof value !== 'string') return `${key} deve ser um texto`
  if (PROFILE_ENUMS[key]) {
    return PROFILE_ENUMS[key].includes(value)
      ? null
      : `${key} deve ser um de: ${PROFILE_ENUMS[key].join(', ')}`
  }
  const [isValid, message] = PROFILE_RULES[key]
  return isValid(value) ? null : message
}

/** Campos exigidos pelo frontend que estão ausentes ou inválidos no perfil salvo. */
const missingProfileFields = (profile) =>
  PROFILE_FIELDS.filter((key) => {
    const value = profile[key]
    return value === undefined || value === null || profileFieldError(key, value) !== null
  })

function guardianFieldError(key, value, profile) {
  if (key === 'acceptsTerms')
    return typeof value === 'boolean' ? null : 'acceptsTerms deve ser booleano'
  if (typeof value !== 'string') return `${key} deve ser um texto`
  if (key === 'guardianType')
    return GUARDIAN_TYPES.includes(value) ? null : 'Escolha o tipo de responsável.'
  if (key === 'displayName' && profile.guardianType === 'INDIVIDUAL') return null
  if (key === 'document') {
    const valid = profile.guardianType === 'ORGANIZATION' ? isValidCnpj(value) : isValidCpf(value)
    return valid
      ? null
      : `Informe um ${profile.guardianType === 'ORGANIZATION' ? 'CNPJ' : 'CPF'} válido.`
  }
  if (key === 'email')
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : 'Informe um e-mail válido.'
  if (key === 'phone')
    return /^\d{10,11}$/.test(digitsOnly(value)) ? null : 'Informe um telefone com DDD.'
  if (key === 'zipCode') return /^\d{8}$/.test(digitsOnly(value)) ? null : 'Informe um CEP válido.'
  const minimum = key === 'description' ? 20 : key === 'city' ? 2 : key === 'address' ? 5 : 3
  return value.trim().length >= minimum
    ? null
    : key === 'description'
      ? 'Conte um pouco sobre o trabalho de proteção animal.'
      : `Preencha ${key}.`
}

const missingGuardianFields = (profile) =>
  GUARDIAN_FIELDS.filter((key) => {
    if (key === 'displayName' && profile.guardianType === 'INDIVIDUAL') return false
    const value = profile[key]
    if (key === 'acceptsTerms') return value !== true
    return value === undefined || value === null || guardianFieldError(key, value, profile) !== null
  })

const STATUS_NAMES = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
}

/** Formato de erro padrão (#47): { statusCode, error, message, details }. */
function sendError(res, statusCode, message, details) {
  const body = { statusCode, error: STATUS_NAMES[statusCode], message }
  if (details) body.details = details
  res.status(statusCode).json(body)
}

const isBlank = (value) => typeof value !== 'string' || value.trim() === ''
const list = (data) => ({ data, total: data.length })

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

function positiveInt(value, field, details, fallback) {
  if (value === undefined) return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    details.push({ field, message: `${field} deve ser um inteiro positivo` })
    return fallback
  }
  return number
}

/**
 * Cria o app Express do mock. `db` pode ser o caminho de um arquivo (persistente)
 * ou um objeto em memória (usado nos testes). `delay` é a latência simulada em ms.
 */
export function createApp({
  db,
  delay = Number(process.env.MOCK_DELAY_MS ?? 300),
  logger = false,
} = {}) {
  const server = jsonServer.create()
  const router = jsonServer.router(db)
  const store = router.db

  const currentUserId = (req) => {
    const requested = req.get('X-Demo-User-Id')
    return requested && store.get('users').find({ id: requested }).value()
      ? requested
      : DEFAULT_DEMO_USER_ID
  }
  const demoUser = (userId = DEFAULT_DEMO_USER_ID) =>
    store.get('users').find({ id: userId }).value()
  const findPet = (id) => store.get('pets').find({ id }).value()
  const myRequests = (userId) => store.get('requests').filter({ userId }).value()
  const withPet = (request) => ({
    ...request,
    pet: findPet(request.petId) ?? null,
  })
  const getProfile = (userId) => {
    const profile = store.get('profile').value() ?? {}
    if (profile.userId !== userId) {
      const missingFields = missingProfileFields({})
      return { userId, isComplete: false, missingFields }
    }
    const missingFields = missingProfileFields(profile)
    return { ...profile, isComplete: missingFields.length === 0, missingFields }
  }
  const getGuardianProfile = (userId) => {
    const profile = store.get('guardianProfile').value() ?? {}
    if (profile.userId !== userId) {
      const missingFields = missingGuardianFields({})
      return { userId, isComplete: false, missingFields }
    }
    const missingFields = missingGuardianFields(profile)
    return { ...profile, isComplete: missingFields.length === 0, missingFields }
  }
  const requireGuardian = (req, res) => {
    const user = demoUser(currentUserId(req))
    if (user?.roles?.includes('GUARDIAN')) return true
    sendError(res, 403, 'Esta área é exclusiva para instituições e protetores')
    return false
  }

  const organizationIdentity = (userId) => {
    const user = demoUser(userId) ?? {}
    const profile = getGuardianProfile(userId)
    const name =
      profile.displayName ||
      profile.legalName ||
      user.organizationName ||
      user.name ||
      'Instituição'
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('')
    return { name, initials: initials || 'IN', user }
  }
  const organizationPets = (userId) => {
    const { name } = organizationIdentity(userId)
    return store.get('pets').filter({ organization: name }).value()
  }
  const presentOrganizationPet = (pet) => ({ ...pet, distance: null, distanceKm: null })
  const withReceivedRequest = (request) => {
    const user = demoUser(request.userId) ?? {}
    const profile = getProfile(request.userId)
    const completed = PROFILE_FIELDS.length - profile.missingFields.length
    return {
      ...withPet(request),
      adopter: {
        id: request.userId,
        name: profile.name || user.name || '',
        email: profile.email || user.email || '',
        phone: profile.phone || user.phone || '',
        completion: Math.round((completed / PROFILE_FIELDS.length) * 100),
        housing: profile.housing,
        dailyTime: profile.dailyTime,
        experience: profile.experience,
        hasChildren: profile.hasChildren,
        hasOtherPets: profile.hasOtherPets,
      },
    }
  }

  const presentPet = (pet) => {
    const user = demoUser()
    const hasCoords =
      typeof user?.lat === 'number' &&
      typeof user?.lng === 'number' &&
      typeof pet.lat === 'number' &&
      typeof pet.lng === 'number'
    const distanceKm = hasCoords
      ? Math.round(haversineKm(user.lat, user.lng, pet.lat, pet.lng) * 10) / 10
      : null
    return {
      ...pet,
      distanceKm,
      distance: distanceKm === null ? null : `${String(distanceKm).replace('.', ',')} km`,
    }
  }

  // Aceita tanto /pets quanto /api/pets (acesso direto sem o proxy do Vite).
  server.use((req, _res, next) => {
    if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
      req.url = req.url.slice(4) || '/'
    }
    next()
  })
  server.use(jsonServer.defaults({ logger, noGzip: true, bodyParser: true }))
  server.use((_req, _res, next) => (delay > 0 ? setTimeout(next, delay) : next()))

  // --- Usuário e perfil -----------------------------------------------------
  server.get('/me', (req, res) => {
    const { lat: _lat, lng: _lng, ...user } = demoUser(currentUserId(req))
    res.json(user)
  })

  server.put('/me/account', (req, res) => {
    const userId = currentUserId(req)
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendError(res, 400, 'Corpo da requisição inválido', [
        { field: 'body', message: 'Envie um objeto JSON' },
      ])
    }

    const details = []
    const normalized = {}
    const guardian = body.accountType === 'guardian'
    if (guardian) {
      const required = [
        'organizationName',
        'responsibleName',
        'document',
        'email',
        'phone',
        'zipCode',
        'address',
        'city',
        'state',
      ]
      for (const key of required) {
        const value = body[key]
        if (typeof value !== 'string' || !value.trim()) {
          details.push({ field: key, message: `Preencha ${key}.` })
          continue
        }
        if (['organizationName', 'responsibleName'].includes(key) && value.trim().length < 3)
          details.push({ field: key, message: `Preencha ${key}.` })
        else if (key === 'document' && !isValidCnpj(value))
          details.push({ field: key, message: 'Informe um CNPJ válido.' })
        else if (key === 'email' && profileFieldError('email', value))
          details.push({ field: key, message: 'Informe um e-mail válido.' })
        else if (key === 'phone' && profileFieldError('phone', value))
          details.push({ field: key, message: 'Informe um telefone com DDD.' })
        else if (key === 'zipCode' && profileFieldError('zipCode', value))
          details.push({ field: key, message: 'Informe um CEP válido.' })
        else if (key === 'address' && profileFieldError('address', value))
          details.push({ field: key, message: 'Informe seu endereço.' })
        else if (key === 'city' && value.trim().length < 2)
          details.push({ field: key, message: 'Informe a cidade.' })
        else if (key === 'state' && value.trim().length !== 2)
          details.push({ field: key, message: 'Use a sigla do estado com 2 letras.' })
        else
          normalized[key] = ['document', 'phone', 'zipCode'].includes(key)
            ? digitsOnly(value)
            : value.trim()
      }
      normalized.name = typeof body.responsibleName === 'string' ? body.responsibleName.trim() : ''
    } else {
      for (const key of ['name', 'cpf', 'birthDate', 'email', 'phone', 'zipCode', 'address']) {
        const value = body[key]
        const message = value === undefined ? `Preencha ${key}.` : profileFieldError(key, value)
        if (message) details.push({ field: key, message })
        else normalized[key] = PROFILE_DIGITS.includes(key) ? digitsOnly(value) : value.trim()
      }
    }
    if (typeof body.password !== 'string' || body.password.length < 8) {
      details.push({ field: 'password', message: 'Use pelo menos 8 caracteres.' })
    }
    if (!['adopter', 'guardian'].includes(body.accountType)) {
      details.push({ field: 'accountType', message: 'Escolha o tipo da conta.' })
    }
    if (details.length) return sendError(res, 400, 'Validação falhou', details)

    const user = store
      .get('users')
      .find({ id: userId })
      .assign({
        ...normalized,
        role: guardian ? 'RESPONSAVEL' : 'ADOTANTE',
        roles: [guardian ? 'GUARDIAN' : 'ADOPTER'],
      })
      .write()
    const { lat: _lat, lng: _lng, ...publicUser } = user
    res.json(publicUser)
  })

  server.get('/me/adopter-profile', (req, res) => res.json(getProfile(currentUserId(req))))

  server.put('/me/adopter-profile', (req, res) => {
    const userId = currentUserId(req)
    const body = req.body
    const details = []
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendError(res, 400, 'Corpo da requisição inválido', [
        { field: 'body', message: 'Envie um objeto JSON' },
      ])
    }
    const normalized = {}
    for (const key of PROFILE_FIELDS) {
      if (body[key] === undefined) continue
      // String vazia limpa o campo (o formulário usa '' para "não preenchido").
      if (body[key] === '' && !PROFILE_BOOLEANS.includes(key)) {
        normalized[key] = ''
        continue
      }
      const message = profileFieldError(key, body[key])
      if (message) {
        details.push({ field: key, message })
        continue
      }
      normalized[key] = PROFILE_DIGITS.includes(key) ? digitsOnly(body[key]) : body[key]
    }
    if (details.length) return sendError(res, 400, 'Validação falhou', details)

    const existing = store.get('profile').value() ?? {}
    const next = { ...(existing.userId === userId ? existing : {}), ...normalized, userId }
    store.set('profile', next).write()
    res.json(getProfile(userId))
  })

  server.get('/me/guardian-profile', (req, res) => res.json(getGuardianProfile(currentUserId(req))))

  server.put('/me/guardian-profile', (req, res) => {
    const userId = currentUserId(req)
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendError(res, 400, 'Corpo da requisição inválido', [
        { field: 'body', message: 'Envie um objeto JSON' },
      ])
    }

    const stored = store.get('guardianProfile').value() ?? {}
    const current = stored.userId === userId ? stored : {}
    const next = { ...current, ...body, userId }
    const normalized = {}
    const details = []
    for (const key of GUARDIAN_FIELDS) {
      if (body[key] === undefined) continue
      if (body[key] === '' && key !== 'acceptsTerms') {
        normalized[key] = ''
        continue
      }
      const message = guardianFieldError(key, body[key], next)
      if (message) details.push({ field: key, message })
      else normalized[key] = GUARDIAN_DIGITS.includes(key) ? digitsOnly(body[key]) : body[key]
    }
    if (details.length) return sendError(res, 400, 'Validação falhou', details)

    store.set('guardianProfile', { ...current, ...normalized, userId }).write()
    const user = demoUser(userId)
    const roles = Array.from(new Set([...(user.roles ?? ['ADOPTER']), 'GUARDIAN']))
    store.get('users').find({ id: userId }).assign({ roles }).write()
    res.json(getGuardianProfile(userId))
  })

  // --- Área da instituição --------------------------------------------------
  server.get('/me/organization-pets', (req, res) => {
    if (!requireGuardian(req, res)) return
    const pets = organizationPets(currentUserId(req)).map(presentOrganizationPet)
    res.json(list(pets))
  })

  const validateOrganizationPet = (body) => {
    const details = []
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return [{ field: 'body', message: 'Envie um objeto JSON' }]
    }
    for (const key of ORGANIZATION_PET_FIELDS) {
      const value = body[key]
      if (key === 'age') {
        if (!Number.isInteger(value) || value < 0 || value > 30)
          details.push({ field: key, message: 'A idade deve ser um número entre 0 e 30' })
      } else if (key === 'traits') {
        if (!Array.isArray(value) || !value.length || value.some(isBlank))
          details.push({ field: key, message: 'Informe ao menos uma característica' })
      } else if (['children', 'otherPets', 'specialCare', 'vaccinated', 'neutered'].includes(key)) {
        if (typeof value !== 'boolean')
          details.push({ field: key, message: 'Informe verdadeiro ou falso' })
      } else if (isBlank(value)) details.push({ field: key, message: `${key} é obrigatório` })
    }
    if (typeof body?.image === 'string') {
      try {
        new URL(body.image)
      } catch {
        details.push({ field: 'image', message: 'Informe uma URL válida' })
      }
    }
    return details
  }

  server.post('/me/organization-pets', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const details = validateOrganizationPet(req.body)
    if (details.length) return sendError(res, 400, 'Validação falhou', details)
    const {
      name: organization,
      initials: organizationInitials,
      user,
    } = organizationIdentity(userId)
    const baseId =
      req.body.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'pet'
    let id = baseId
    let suffix = 2
    while (findPet(id)) id = `${baseId}-${suffix++}`
    const pet = {
      ...req.body,
      id,
      ageLabel: `${req.body.age} ${req.body.age === 1 ? 'ano' : 'anos'}`,
      gallery: [req.body.image],
      organization,
      organizationInitials,
      lat: typeof user.lat === 'number' ? user.lat : -23.5505,
      lng: typeof user.lng === 'number' ? user.lng : -46.6333,
      createdAt: new Date().toISOString(),
    }
    store.get('pets').push(pet).write()
    res.status(201).json(presentOrganizationPet(pet))
  })

  server.put('/me/organization-pets/:id', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const existing = organizationPets(userId).find(({ id }) => id === req.params.id)
    if (!existing)
      return sendError(res, 404, 'Pet não encontrado entre os cadastros da instituição')
    const details = validateOrganizationPet(req.body)
    if (details.length) return sendError(res, 400, 'Validação falhou', details)
    const updated = {
      ...existing,
      ...req.body,
      id: existing.id,
      ageLabel: `${req.body.age} ${req.body.age === 1 ? 'ano' : 'anos'}`,
      gallery: existing.gallery?.length
        ? [req.body.image, ...existing.gallery.filter((item) => item !== req.body.image)]
        : [req.body.image],
    }
    store.get('pets').find({ id: existing.id }).assign(updated).write()
    res.json(presentOrganizationPet(updated))
  })

  server.delete('/me/organization-pets/:id', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const existing = organizationPets(userId).find(({ id }) => id === req.params.id)
    if (!existing)
      return sendError(res, 404, 'Pet não encontrado entre os cadastros da instituição')
    const hasRequests = store.get('requests').some({ petId: existing.id }).value()
    if (hasRequests)
      return sendError(res, 409, 'Não é possível remover um pet que possui solicitações')
    store.get('pets').remove({ id: existing.id }).write()
    store.get('favorites').remove({ petId: existing.id }).write()
    res.status(204).end()
  })

  server.get('/me/received-requests', (req, res) => {
    if (!requireGuardian(req, res)) return
    const petIds = new Set(organizationPets(currentUserId(req)).map(({ id }) => id))
    const requests = store
      .get('requests')
      .value()
      .filter(({ petId }) => petIds.has(petId))
      .reverse()
      .map(withReceivedRequest)
    res.json(list(requests))
  })

  server.post('/me/received-requests/:id/transitions', (req, res) => {
    if (!requireGuardian(req, res)) return
    const petIds = new Set(organizationPets(currentUserId(req)).map(({ id }) => id))
    const request = store.get('requests').find({ id: req.params.id }).value()
    if (!request || !petIds.has(request.petId))
      return sendError(res, 404, 'Solicitação não encontrada')
    const to = String(req.body?.to ?? '').toUpperCase()
    const status = ORGANIZATION_REQUEST_TRANSITIONS[to]
    if (!status) return sendError(res, 400, 'Transição não suportada')
    const allowed =
      (request.status === 'Enviada' && ['Em análise', 'Recusada'].includes(status)) ||
      (request.status === 'Em análise' && ['Aprovada', 'Recusada'].includes(status))
    if (!allowed)
      return sendError(
        res,
        409,
        `Não é possível alterar uma solicitação com status "${request.status}" para "${status}"`,
      )
    const messages = {
      'Em análise': 'A instituição iniciou a análise da sua solicitação.',
      Aprovada: 'Sua solicitação foi aprovada pela instituição.',
      Recusada: 'A instituição encerrou esta solicitação.',
    }
    const updated = { ...request, status, message: messages[status] }
    store.get('requests').find({ id: request.id }).assign(updated).write()
    res.json(withReceivedRequest(updated))
  })

  // --- Pets -------------------------------------------------------------------
  server.get('/pets', (req, res, next) => {
    const { search, page, limit, sort = 'recent', ...filters } = req.query
    const details = Object.keys(req.query)
      .filter((key) => !PETS_QUERY_PARAMS.includes(key))
      .map((field) => ({ field, message: 'Parâmetro desconhecido' }))
    const pageNumber = positiveInt(page, 'page', details, 1)
    const limitNumber = positiveInt(limit, 'limit', details, DEFAULT_LIMIT)
    if (limitNumber > MAX_LIMIT)
      details.push({ field: 'limit', message: `limit máximo é ${MAX_LIMIT}` })
    if (!SORTS.includes(sort)) {
      details.push({
        field: 'sort',
        message: `sort deve ser um de: ${SORTS.join(', ')}`,
      })
    }
    if (details.length) return sendError(res, 400, 'Parâmetros de consulta inválidos', details)

    if (sort === 'distance') {
      // json-server não ordena por valor calculado; faz a ordenação aqui.
      const term = typeof search === 'string' ? search.toLowerCase() : ''
      const matches = store
        .get('pets')
        .value()
        .filter((pet) => {
          const text = Object.values(pet)
            .filter((v) => typeof v === 'string')
            .join(' ')
            .toLowerCase()
          // Parâmetro repetido (?size=A&size=B) significa "um dos valores".
          const exact = Object.entries(filters).every(([key, value]) =>
            [value].flat().some((item) => String(pet[key]) === String(item)),
          )
          return exact && (!term || text.includes(term))
        })
        .map(presentPet)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      const start = (pageNumber - 1) * limitNumber
      return res.json({
        data: matches.slice(start, start + limitNumber),
        total: matches.length,
      })
    }

    // Traduz o contrato (#49) para a query do json-server.
    req.query = {
      ...filters,
      _page: String(pageNumber),
      _limit: String(limitNumber),
      ...(search ? { q: search } : {}),
      ...(sort === 'name'
        ? { _sort: 'name', _order: 'asc' }
        : { _sort: 'createdAt', _order: 'desc' }),
    }
    next()
  })

  // --- Solicitações -----------------------------------------------------------
  server.post('/requests', (req, res) => {
    const userId = currentUserId(req)
    const { petId, answers } = req.body ?? {}
    const details = []
    if (isBlank(petId)) details.push({ field: 'petId', message: 'petId é obrigatório' })
    const a = answers && typeof answers === 'object' ? answers : {}
    if (!answers || typeof answers !== 'object') {
      details.push({ field: 'answers', message: 'answers é obrigatório' })
    }
    const minLength = { motivation: 20, routine: 20, adaptation: 15 }
    for (const [key, min] of Object.entries(minLength)) {
      if (isBlank(a[key]) || a[key].trim().length < min) {
        details.push({
          field: `answers.${key}`,
          message: `${key} deve ter ao menos ${min} caracteres`,
        })
      }
    }
    if (isBlank(a.aloneTime))
      details.push({
        field: 'answers.aloneTime',
        message: 'aloneTime é obrigatório',
      })
    for (const key of ['costs', 'commitment']) {
      if (a[key] !== true)
        details.push({
          field: `answers.${key}`,
          message: `${key} precisa ser confirmado`,
        })
    }
    if (details.length) return sendError(res, 400, 'Validação falhou', details)

    if (!findPet(petId)) return sendError(res, 404, 'Pet não encontrado')
    if (!getProfile(userId).isComplete) {
      return sendError(
        res,
        422,
        'Complete seu perfil de adotante antes de solicitar uma adoção',
        getProfile(userId).missingFields.map((field) => ({
          field,
          message: 'Campo obrigatório do perfil não preenchido ou inválido',
        })),
      )
    }
    const duplicate = myRequests(userId).some(
      (request) => request.petId === petId && ACTIVE_STATUSES.includes(request.status),
    )
    if (duplicate) return sendError(res, 409, 'Você já possui uma solicitação ativa para este pet')

    const lastNumber = store
      .get('requests')
      .value()
      .reduce((max, { id }) => Math.max(max, Number(/^SOL-(\d+)$/.exec(id)?.[1] ?? 0)), 1042)
    const request = {
      id: `SOL-${String(lastNumber + 1).padStart(4, '0')}`,
      userId,
      petId,
      status: 'Enviada',
      date: new Date().toISOString(),
      message: 'Sua solicitação foi enviada e aguarda o início da análise.',
      answers: {
        motivation: a.motivation,
        routine: a.routine,
        aloneTime: a.aloneTime,
        adaptation: a.adaptation,
        costs: true,
        commitment: true,
      },
    }
    store.get('requests').push(request).write()
    res.status(201).json(withPet(request))
  })

  server.get('/me/requests', (req, res) => {
    const requests = myRequests(currentUserId(req)).reverse().map(withPet)
    res.json(list(requests))
  })

  server.get('/requests/:id', (req, res) => {
    const request = myRequests(currentUserId(req)).find(({ id }) => id === req.params.id)
    if (!request) return sendError(res, 404, 'Solicitação não encontrada')
    res.json(withPet(request))
  })

  server.post('/requests/:id/transitions', (req, res) => {
    const request = myRequests(currentUserId(req)).find(({ id }) => id === req.params.id)
    if (!request) return sendError(res, 404, 'Solicitação não encontrada')
    const to = String(req.body?.to ?? '').toUpperCase()
    if (to !== 'CANCELADA') {
      return sendError(res, 400, 'Transição não suportada', [
        { field: 'to', message: 'Apenas CANCELADA é permitida' },
      ])
    }
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      return sendError(
        res,
        409,
        `Não é possível cancelar uma solicitação com status "${request.status}"`,
      )
    }
    const updated = {
      ...request,
      status: 'Cancelada',
      message: 'Solicitação cancelada por você.',
    }
    store.get('requests').find({ id: request.id }).assign(updated).write()
    res.json(withPet(updated))
  })

  // --- Favoritos ---------------------------------------------------------------
  const myFavorites = (userId) => store.get('favorites').filter({ userId }).value()

  server.get('/me/favorites/ids', (req, res) =>
    res.json(list(myFavorites(currentUserId(req)).map((f) => f.petId))),
  )

  server.get('/me/favorites', (req, res) => {
    const pets = myFavorites(currentUserId(req))
      .map((favorite) => findPet(favorite.petId))
      .filter(Boolean)
      .map(presentPet)
    res.json(list(pets))
  })

  server.put('/me/favorites/:petId', (req, res) => {
    const userId = currentUserId(req)
    const { petId } = req.params
    if (!findPet(petId)) return sendError(res, 404, 'Pet não encontrado')
    if (!myFavorites(userId).some((favorite) => favorite.petId === petId)) {
      const nextId =
        store
          .get('favorites')
          .value()
          .reduce((max, { id }) => Math.max(max, id), 0) + 1
      store
        .get('favorites')
        .push({
          id: nextId,
          userId,
          petId,
          createdAt: new Date().toISOString(),
        })
        .write()
    }
    res.status(204).end()
  })

  server.delete('/me/favorites/:petId', (req, res) => {
    store
      .get('favorites')
      .remove({ userId: currentUserId(req), petId: req.params.petId })
      .write()
    res.status(204).end()
  })

  // --- Respostas do json-server no formato do contrato --------------------------
  router.render = (req, res) => {
    if (res.statusCode === 404) {
      const resource = req.path.split('/')[1]
      const message = resource === 'pets' ? 'Pet não encontrado' : 'Recurso não encontrado'
      return sendError(res, 404, message)
    }
    if (req.path === '/pets' && req.method === 'GET' && Array.isArray(res.locals.data)) {
      const total = Number(res.getHeader('X-Total-Count') ?? res.locals.data.length)
      return res.json({ data: res.locals.data.map(presentPet), total })
    }
    if (/^\/pets\/[^/]+$/.test(req.path) && req.method === 'GET') {
      return res.json(presentPet(res.locals.data))
    }
    return res.jsonp(res.locals.data)
  }
  server.use(router)

  // Express identifica o handler de erro pela aridade (4 args), então `_next` precisa existir.
  server.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed')
      return sendError(res, 400, 'JSON inválido no corpo da requisição')
    sendError(res, 500, 'Erro interno do servidor')
  })

  return server
}

/** Copia o seed para db.json na primeira execução. */
export function ensureDb() {
  if (!existsSync(DB_PATH)) copyFileSync(SEED_PATH, DB_PATH)
  return DB_PATH
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.MOCK_PORT ?? 3001)
  const app = createApp({ db: ensureDb(), logger: true })
  app.listen(port, () => {
    console.log(`Mock API em http://localhost:${port} (rotas também em /api)`)
  })
}
