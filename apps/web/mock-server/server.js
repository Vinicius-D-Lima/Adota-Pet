import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Busboy from 'busboy'
import jsonServer from 'json-server'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SEED_PATH = path.join(here, 'db.seed.json')
export const DB_PATH = path.join(here, 'db.json')

const DEFAULT_DEMO_USER_ID = process.env.DEMO_USER_ID ?? 'demo'
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 100
const CHECK_IN_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CHECK_IN_MAX_PHOTOS = 5
const CHECK_IN_MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ACTIVE_STATUSES = ['Enviada', 'Em análise', 'Aprovada']
const CANCELLABLE_STATUSES = ['Enviada', 'Em análise']
const FINAL_REQUEST_STATUSES = ['Aprovada', 'Recusada', 'Cancelada']
const SORTS = ['recent', 'name', 'distance']
const NOTIFICATION_TYPES = [
  'RequestStatusChanged',
  'AppointmentProposed',
  'AppointmentConfirmed',
  'MessageReceived',
  'CheckInDue',
  'CheckInOverdue',
  'CheckInReviewed',
  'NewRequestForOrganization',
  'NewMatchingPet',
]
const DEFAULT_EMAIL_NOTIFICATION_TYPES = [
  'RequestStatusChanged',
  'AppointmentConfirmed',
  'CheckInOverdue',
  'NewRequestForOrganization',
]
const PETS_QUERY_PARAMS = ['search', 'page', 'limit', 'sort', 'species', 'size', 'sex', 'city']
const SAVED_FILTER_FIELDS = ['search', 'species', 'size', 'sex', 'city']
const SAVED_FILTER_ENUMS = {
  species: ['Cachorro', 'Gato'],
  size: ['Pequeno', 'Médio', 'Grande'],
  sex: ['Fêmea', 'Macho'],
}
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
const INTERVIEW_TYPES = ['Entrevista online', 'Visita presencial']
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

/** Lê o multipart do upload de exames sem depender do parser do json-server. */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    let parser
    try {
      parser = Busboy({ headers: req.headers })
    } catch (error) {
      reject(error)
      return
    }
    const fields = {}
    const files = []
    let file = null
    let finished = false
    let pendingFiles = 0
    let readFiles = 0
    const maybeResolve = () => {
      if (finished && readFiles === pendingFiles) resolve({ fields, file, files })
    }
    parser.on('field', (name, value) => {
      fields[name] = value
    })
    parser.on('file', (name, stream, info) => {
      pendingFiles += 1
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        file = {
          field: name,
          filename: info.filename || 'arquivo',
          contentType: info.mimeType || 'application/octet-stream',
          buffer: Buffer.concat(chunks),
        }
        files.push(file)
        readFiles += 1
        maybeResolve()
      })
    })
    parser.on('error', reject)
    parser.on('finish', () => {
      finished = true
      maybeResolve()
    })
    req.pipe(parser)
  })
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

/** Iniciais derivadas do nome — usadas ao criar organizações a partir do seed. */
function organizationInitialsOf(name) {
  return (
    String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'IN'
  )
}

/** Slug estável para o ID de uma organização derivada do nome de um pet. */
function organizationSlug(name) {
  return (
    String(name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'organizacao'
  )
}

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
  if (!Array.isArray(store.get('chatMessages').value())) store.set('chatMessages', []).write()
  if (!Array.isArray(store.get('savedFilters').value())) store.set('savedFilters', []).write()
  if (!Array.isArray(store.get('notifications').value())) store.set('notifications', []).write()
  if (!Array.isArray(store.get('notificationPreferences').value()))
    store.set('notificationPreferences', []).write()
  if (!Array.isArray(store.get('medicalRecords').value())) store.set('medicalRecords', []).write()
  if (!Array.isArray(store.get('storageObjects').value())) store.set('storageObjects', []).write()
  if (!Array.isArray(store.get('followUpPlans').value())) store.set('followUpPlans', []).write()
  if (!Array.isArray(store.get('checkIns').value())) store.set('checkIns', []).write()

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
  const mySavedFilters = (userId) =>
    store
      .get('savedFilters')
      .filter({ userId })
      .value()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const presentSavedFilter = ({ userId: _userId, ...savedFilter }) => savedFilter
  const validateSavedFilter = (body, partial = false) => {
    const details = []
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return [{ field: 'body', message: 'Envie um objeto JSON' }]
    }

    for (const key of Object.keys(body)) {
      if (!['name', 'criteria', 'active'].includes(key)) {
        details.push({ field: key, message: 'Campo desconhecido' })
      }
    }
    if (!partial || Object.hasOwn(body, 'name')) {
      if (isBlank(body.name) || body.name.trim().length > 80) {
        details.push({ field: 'name', message: 'Informe um nome com até 80 caracteres' })
      }
    }
    if (!partial || Object.hasOwn(body, 'criteria')) {
      const criteria = body.criteria
      if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
        details.push({ field: 'criteria', message: 'Informe os critérios como um objeto' })
      } else {
        for (const key of Object.keys(criteria)) {
          if (!SAVED_FILTER_FIELDS.includes(key)) {
            details.push({ field: `criteria.${key}`, message: 'Critério desconhecido' })
          } else if (key === 'size') {
            if (
              !Array.isArray(criteria.size) ||
              criteria.size.length === 0 ||
              criteria.size.some((value) => !SAVED_FILTER_ENUMS.size.includes(value)) ||
              new Set(criteria.size).size !== criteria.size.length
            ) {
              details.push({
                field: 'criteria.size',
                message: 'Informe portes válidos e sem repetição',
              })
            }
          } else if (SAVED_FILTER_ENUMS[key]) {
            if (!SAVED_FILTER_ENUMS[key].includes(criteria[key])) {
              details.push({
                field: `criteria.${key}`,
                message: `Valor inválido para ${key}`,
              })
            }
          } else if (
            isBlank(criteria[key]) ||
            (key === 'city' && criteria[key].trim().length < 2)
          ) {
            details.push({ field: `criteria.${key}`, message: 'Informe um valor válido' })
          }
        }
        if (Object.keys(criteria).length === 0) {
          details.push({ field: 'criteria', message: 'Informe ao menos um critério de busca' })
        }
      }
    }
    if (!partial || Object.hasOwn(body, 'active')) {
      if (typeof body.active !== 'boolean') {
        details.push({ field: 'active', message: 'active deve ser verdadeiro ou falso' })
      }
    }
    if (partial && Object.keys(body).length === 0) {
      details.push({ field: 'body', message: 'Informe ao menos um campo para atualizar' })
    }
    return details
  }
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
  const organizationPets = (userId, organizationId = '') => {
    const selected = organizationId
      ? store.get('organizations').find({ id: organizationId }).value()
      : null
    const name = selected?.name ?? organizationIdentity(userId).name
    return store.get('pets').filter({ organization: name }).value()
  }
  const demoRole = (req) =>
    String(
      req.headers['x-demo-role'] || req.query.role || req.cookies?.demoRole || '',
    ).toUpperCase() === 'VOLUNTEER'
      ? 'VOLUNTEER'
      : 'ADMIN'
  const permissionsForRole = (role) =>
    role === 'ADMIN'
      ? ['requests:view', 'requests:review', 'requests:approve', 'requests:reject']
      : ['requests:view', 'requests:review', 'requests:reject']

  // --- Organizações, membros e convites (API simulada do #41) ----------------
  // As coleções são derivadas do seed (perfil da instituição e pets) para não
  // duplicar nomes "fixos" de ONG. db.seed.json não é alterado.
  for (const key of ['organizations', 'memberships', 'invitations']) {
    if (!Array.isArray(store.get(key).value())) store.set(key, []).write()
  }
  const guardianUserId = store.get('guardianProfile').value()?.userId || 'demo-organization'
  if (store.get('organizations').value().length === 0) {
    const profile = store.get('guardianProfile').value() ?? {}
    const pets = store.get('pets').value() ?? []
    const primaryName = profile.displayName || profile.legalName || 'Instituição'
    const primary = {
      id: 'demo-organization',
      name: primaryName,
      displayName: primaryName,
      initials: organizationInitialsOf(primaryName),
      description: profile.description ?? '',
      city: profile.city ?? '',
      contactEmail: profile.email ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      cnpj: profile.document ?? null,
      document: profile.document ?? null,
      logoUrl: null,
    }
    const fromPets = pets
      .filter((pet) => pet.organization && pet.organization !== primaryName)
      .map((pet) => ({
        id: organizationSlug(pet.organization),
        name: pet.organization,
        displayName: pet.organization,
        initials: pet.organizationInitials ?? organizationInitialsOf(pet.organization),
        description: `Protetora responsável por ${pet.name} e outros animais.`,
        city: pet.city ?? '',
        contactEmail: '',
        email: '',
        phone: '',
        address: '',
        cnpj: null,
        document: null,
        logoUrl: null,
      }))
    store.set('organizations', [primary, ...fromPets]).write()
  }
  if (store.get('memberships').value().length === 0) {
    const organizations = store.get('organizations').value()
    const guardian = demoUser(guardianUserId) ?? {}
    store
      .set('memberships', [
        {
          id: 'membership-admin',
          userId: guardianUserId,
          organizationId: organizations[0].id,
          role: 'ADMIN',
          status: 'ATIVO',
          joinedAt: '2026-01-10T12:00:00.000Z',
          user: { id: guardianUserId, name: guardian.name, email: guardian.email },
        },
        {
          id: 'membership-volunteer',
          userId: guardianUserId,
          organizationId: organizations[1]?.id ?? organizations[0].id,
          role: 'VOLUNTEER',
          status: 'ATIVO',
          joinedAt: '2026-03-04T12:00:00.000Z',
          user: { id: guardianUserId, name: guardian.name, email: guardian.email },
        },
        {
          id: 'membership-mariana',
          userId: 'mariana',
          organizationId: organizations[0].id,
          role: 'VOLUNTEER',
          status: 'ATIVO',
          joinedAt: '2026-04-18T12:00:00.000Z',
          user: {
            id: 'mariana',
            name: 'Mariana Souza',
            email: 'mariana@adotapet.local',
          },
        },
      ])
      .write()
  }

  const organizationsForUser = (userId) =>
    store
      .get('memberships')
      .value()
      .filter((membership) => membership.userId === userId && membership.status === 'ATIVO')
      .map((membership) =>
        store.get('organizations').find({ id: membership.organizationId }).value(),
      )
      .filter(Boolean)
  const organizationById = (id) => store.get('organizations').find({ id }).value()
  const primaryOrganizationId = (userId) => organizationsForUser(userId)[0]?.id ?? ''
  /** Query `?organizationId=` (ou header) escolhe a ONG; inválida cai na principal. */
  const activeOrganizationId = (req) => {
    const requested =
      (typeof req.query.organizationId === 'string' && req.query.organizationId) ||
      String(req.get('X-Organization-Id') ?? '')
    const userId = currentUserId(req)
    const member = store
      .get('memberships')
      .value()
      .find(
        (item) =>
          item.userId === userId && item.organizationId === requested && item.status === 'ATIVO',
      )
    return member ? requested : primaryOrganizationId(userId)
  }
  const effectiveRole = (req, organizationId) => {
    const membership = store
      .get('memberships')
      .value()
      .find(
        (item) =>
          item.userId === currentUserId(req) &&
          item.organizationId === organizationId &&
          item.status === 'ATIVO',
      )
    // X-Demo-Role continua controlando a ONG principal para os testes de RBAC.
    return organizationId === primaryOrganizationId(currentUserId(req))
      ? demoRole(req)
      : (membership?.role ?? 'VOLUNTEER')
  }
  const rulesForRole = (role) =>
    role === 'ADMIN'
      ? [{ action: 'manage', subject: 'all' }]
      : [
          { action: ['read', 'review', 'reject'], subject: 'Request' },
          { action: 'read', subject: ['Pet', 'Organization', 'Adoption'] },
        ]
  const presentOrganization = (organization) => ({
    ...organization,
    displayName: organization.displayName ?? organization.name,
    document: organization.document ?? organization.cnpj,
    email: organization.email ?? organization.contactEmail,
  })
  const requireMembership = (req, res, organizationId, adminOnly = false) => {
    const membership = store
      .get('memberships')
      .value()
      .find(
        (item) =>
          item.userId === currentUserId(req) &&
          item.organizationId === organizationId &&
          item.status === 'ATIVO',
      )
    if (!membership) {
      sendError(res, 403, 'Você não pertence a esta organização')
      return null
    }
    if (adminOnly && effectiveRole(req, organizationId) !== 'ADMIN') {
      sendError(res, 403, 'Somente administradores podem realizar esta ação')
      return null
    }
    return membership
  }
  const presentMembership = (membership) => ({
    id: membership.id,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    joinedAt: membership.joinedAt,
    user: membership.user,
  })
  const presentInvitation = (invitation) => ({
    id: invitation.id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    status: invitation.expiresAt < new Date().toISOString() ? 'EXPIRADO' : invitation.status,
    acceptUrl: `/convite/${invitation.token}`,
  })
  const invitationByToken = (token) =>
    store
      .get('invitations')
      .value()
      .find((invitation) => invitation.token === token)

  const isChatParticipant = (request, userId) =>
    request.userId === userId || organizationPets(userId).some(({ id }) => id === request.petId)
  const messagesForRequest = (requestId) =>
    store
      .get('chatMessages')
      .filter({ requestId })
      .value()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const unreadChatCount = (requestId, userId) =>
    messagesForRequest(requestId).filter(
      (message) => message.authorId !== userId && !message.readAt,
    ).length
  const presentChatMessage = (message, userId) => {
    const request = store.get('requests').find({ id: message.requestId }).value()
    const authorName =
      message.authorId === request?.userId
        ? getProfile(message.authorId).name || demoUser(message.authorId)?.name || 'Adotante'
        : organizationIdentity(message.authorId).name
    return {
      id: message.id,
      authorName,
      mine: message.authorId === userId,
      body: message.body,
      createdAt: message.createdAt,
      readAt: message.readAt,
    }
  }
  const presentOrganizationPet = (pet) => ({ ...pet, distance: null, distanceKm: null })
  const withReceivedRequest = (request, viewerId) => {
    const user = demoUser(request.userId) ?? {}
    const profile = getProfile(request.userId)
    const completed = PROFILE_FIELDS.length - profile.missingFields.length
    return {
      ...withPet(request),
      unreadMessageCount: unreadChatCount(request.id, viewerId),
      interview: request.interview ?? null,
      rejectionReason: request.rejectionReason ?? null,
      adopter: {
        id: request.userId,
        name: profile.name || user.name || '',
        email: profile.email || user.email || '',
        phone: profile.phone || user.phone || '',
        completion: Math.round((completed / PROFILE_FIELDS.length) * 100),
        housing: profile.housing,
        dailyTime: profile.dailyTime,
        activityLevel: profile.activityLevel || 'Moderado',
        hasOutdoorArea: profile.hasOutdoorArea ?? false,
        acceptsSpecialCare: profile.acceptsSpecialCare ?? false,
        experience: profile.experience,
        hasChildren: profile.hasChildren,
        hasOtherPets: profile.hasOtherPets,
        preferredSpecies: profile.preferredSpecies,
        preferredSize: profile.preferredSize,
        zipCode: profile.zipCode,
        address: profile.address,
        city: user.city,
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

  // --- Prontuário médico (#29/#42) -----------------------------------------
  const MEDICAL_COLLECTIONS = {
    vaccinations: 'vaccinations',
    conditions: 'healthConditions',
    exams: 'exams',
  }
  const HEALTH_CONDITION_TYPES = ['CRONICA', 'EM_TRATAMENTO', 'TRATADA']
  const nowIso = () => new Date().toISOString()
  const makeId = (prefix) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const isIsoDate = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  const medicalAudit = (item) => ({
    createdAt: item?.createdAt ?? nowIso(),
    createdById: item?.createdById ?? 'SYSTEM',
    updatedAt: item?.updatedAt ?? nowIso(),
    updatedById: item?.updatedById ?? 'SYSTEM',
  })
  const medicalRecordOf = (petId) => store.get('medicalRecords').find({ petId }).value()
  const isMedicalMember = (req, pet) => {
    if (!pet) return false
    const userId = currentUserId(req)
    return organizationsForUser(userId).some((organization) =>
      organizationPets(userId, organization.id).some(({ id }) => id === pet.id),
    )
  }
  const canViewCompleteMedicalRecord = (req, pet) =>
    isMedicalMember(req, pet) ||
    Boolean(
      pet &&
      myRequests(currentUserId(req)).some(
        (request) => request.petId === pet.id && ACTIVE_STATUSES.includes(request.status),
      ),
    )
  const deriveMedicalHealth = (record) => {
    const vaccinations = record?.vaccinations ?? []
    return {
      vaccinated:
        vaccinations.length > 0 &&
        vaccinations.every((item) => !item.nextDoseAt || Date.parse(item.nextDoseAt) >= Date.now()),
      neutered: Boolean(record?.neutering?.done),
      specialCare: (record?.healthConditions ?? []).some(
        (item) => item.careRequired && ['CRONICA', 'EM_TRATAMENTO'].includes(item.type),
      ),
    }
  }
  const publicMedicalRecord = (pet, record) => ({
    petId: pet.id,
    ...deriveMedicalHealth(record),
    neutering: {
      done: Boolean(record?.neutering?.done),
      date: record?.neutering?.date ?? null,
    },
    vaccinations: (record?.vaccinations ?? []).map(
      ({ id, name, appliedAt, nextDoseAt, batch, veterinarian }) => ({
        id,
        name,
        appliedAt,
        nextDoseAt: nextDoseAt ?? null,
        batch: batch ?? null,
        veterinarian: veterinarian ?? null,
      }),
    ),
    healthConditions: (record?.healthConditions ?? []).map(({ id, name, type, careRequired }) => ({
      id,
      name,
      type,
      careRequired,
    })),
  })
  const signedAttachment = (objectId) => {
    if (!objectId) return null
    const object = store.get('storageObjects').find({ id: objectId }).value()
    if (!object) return null
    return {
      id: object.id,
      url: `/files/${object.id}?token=mock-assinado`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    }
  }
  const presentMedicalRecord = (req, pet, record) => {
    const base = publicMedicalRecord(pet, record)
    if (!canViewCompleteMedicalRecord(req, pet)) return base
    return {
      ...base,
      complete: true,
      neutering: { ...base.neutering, ...medicalAudit(record?.neutering) },
      vaccinations: (record?.vaccinations ?? []).map((item) => ({
        ...item,
        ...medicalAudit(item),
      })),
      healthConditions: (record?.healthConditions ?? []).map((item) => ({
        ...item,
        notes: item.notes ?? '',
        ...medicalAudit(item),
      })),
      exams: (record?.exams ?? []).map((item) => ({
        id: item.id,
        type: item.type,
        date: item.date,
        result: item.result,
        attachment: signedAttachment(item.attachment),
        ...medicalAudit(item),
      })),
    }
  }
  const ensureMedicalRecord = (petId, userId) => {
    const existing = medicalRecordOf(petId)
    if (existing) return existing
    const record = {
      id: makeId('mr'),
      petId,
      vaccinations: [],
      healthConditions: [],
      exams: [],
      neutering: {
        done: false,
        date: null,
        createdAt: nowIso(),
        createdById: userId,
        updatedAt: nowIso(),
        updatedById: userId,
      },
      createdAt: nowIso(),
      createdById: userId,
      updatedAt: nowIso(),
      updatedById: userId,
    }
    store.get('medicalRecords').push(record).write()
    return record
  }
  const validateMedicalItem = (kind, body) => {
    const details = []
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return [{ field: 'body', message: 'Envie um objeto JSON' }]
    }
    const text = (field, min, max) => {
      if (
        typeof body[field] !== 'string' ||
        body[field].trim().length < min ||
        body[field].length > max
      )
        details.push({ field, message: `Informe ${field} com ${min} a ${max} caracteres` })
    }
    if (kind === 'vaccinations') {
      text('name', 2, 160)
      if (!isIsoDate(body.appliedAt))
        details.push({ field: 'appliedAt', message: 'Informe uma data de aplicação válida' })
      if (body.nextDoseAt != null && !isIsoDate(body.nextDoseAt))
        details.push({ field: 'nextDoseAt', message: 'Informe uma próxima dose válida' })
      if (
        isIsoDate(body.appliedAt) &&
        isIsoDate(body.nextDoseAt) &&
        Date.parse(body.nextDoseAt) < Date.parse(body.appliedAt)
      )
        details.push({
          field: 'nextDoseAt',
          message: 'A próxima dose não pode ser anterior à data de aplicação.',
        })
      for (const field of ['batch', 'veterinarian']) {
        if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > 300))
          details.push({ field, message: `Informe ${field} com até 300 caracteres` })
      }
    } else if (kind === 'conditions') {
      text('name', 2, 160)
      if (!HEALTH_CONDITION_TYPES.includes(body.type))
        details.push({ field: 'type', message: 'Escolha um tipo válido' })
      if (body.notes != null && (typeof body.notes !== 'string' || body.notes.length > 2000))
        details.push({ field: 'notes', message: 'Informe observações com até 2000 caracteres' })
      if (typeof body.careRequired !== 'boolean')
        details.push({
          field: 'careRequired',
          message: 'careRequired deve ser verdadeiro ou falso',
        })
    } else if (kind === 'exams') {
      text('type', 2, 160)
      if (!isIsoDate(body.date)) details.push({ field: 'date', message: 'Informe uma data válida' })
      text('result', 1, 4000)
    }
    return details
  }
  const medicalFields = (kind, body) => {
    if (kind === 'vaccinations')
      return {
        name: body.name.trim(),
        appliedAt: body.appliedAt,
        nextDoseAt: body.nextDoseAt ?? null,
        batch: body.batch || null,
        veterinarian: body.veterinarian || null,
      }
    if (kind === 'conditions')
      return {
        name: body.name.trim(),
        type: body.type,
        notes: body.notes ?? '',
        careRequired: body.careRequired,
      }
    return { type: body.type.trim(), date: body.date, result: body.result.trim() }
  }
  const medicalPetOrError = (req, res) => {
    const pet = findPet(req.params.petId)
    if (!pet) {
      sendError(res, 404, 'Pet não encontrado')
      return null
    }
    if (!isMedicalMember(req, pet)) {
      sendError(res, 403, 'Somente membros da organização responsável podem editar o prontuário')
      return null
    }
    return pet
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
      const guardianType = body.guardianType
      const organization = guardianType === 'ORGANIZATION'
      if (!['INDIVIDUAL', 'ORGANIZATION'].includes(guardianType)) {
        details.push({
          field: 'guardianType',
          message: 'Escolha entre pessoa física e instituição.',
        })
      } else {
        normalized.guardianType = guardianType
      }
      const required = [
        ...(organization ? ['organizationName'] : []),
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
        else if (key === 'document' && !(organization ? isValidCnpj(value) : isValidCpf(value)))
          details.push({
            field: key,
            message: `Informe um ${organization ? 'CNPJ' : 'CPF'} válido.`,
          })
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
      normalized.organizationName =
        organization && typeof body.organizationName === 'string'
          ? body.organizationName.trim()
          : ''
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
    // O cadastro também popula o perfil: /me/* lê destas coleções, não de users.
    if (guardian) {
      const city =
        normalized.city && normalized.state
          ? `${normalized.city}, ${normalized.state}`
          : normalized.city
      store
        .set('guardianProfile', {
          guardianType: normalized.guardianType,
          displayName: normalized.organizationName || normalized.name || normalized.responsibleName,
          legalName: normalized.responsibleName || normalized.name,
          document: normalized.document,
          email: normalized.email,
          phone: normalized.phone,
          zipCode: normalized.zipCode,
          address: normalized.address,
          city,
          description: store.get('guardianProfile').value()?.description ?? '',
          acceptsTerms: true,
          userId,
        })
        .write()
    } else {
      store
        .get('profile')
        .assign({
          name: normalized.name,
          cpf: normalized.cpf,
          birthDate: normalized.birthDate,
          email: normalized.email,
          phone: normalized.phone,
          zipCode: normalized.zipCode,
          address: normalized.address,
          userId,
        })
        .write()
    }
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
    const pets = organizationPets(currentUserId(req), activeOrganizationId(req)).map(
      presentOrganizationPet,
    )
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

  server.get('/me/permissions', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const organizationId = activeOrganizationId(req)
    const organization = organizationById(organizationId)
    const role = effectiveRole(req, organizationId)
    const identity = organizationIdentity(userId)
    const current = organization
      ? { id: organization.id, name: organization.name, initials: organization.initials }
      : { id: userId, name: identity.name, initials: identity.initials }
    res.json({
      role,
      canApprove: role === 'ADMIN',
      permissions: permissionsForRole(role),
      organization: current,
      organizations: organizationsForUser(userId).map((item) => ({
        id: item.id,
        name: item.name,
        initials: item.initials,
        role: effectiveRole(req, item.id),
      })),
      rules: rulesForRole(role),
    })
  })

  server.get('/me/organizations', (req, res) => {
    if (!requireGuardian(req, res)) return
    const data = organizationsForUser(currentUserId(req)).map((organization) => ({
      ...organization,
      role: effectiveRole(req, organization.id),
    }))
    res.json({ ...list(data), total: data.length })
  })

  server.get('/organizations/:id', (req, res) => {
    if (!requireMembership(req, res, req.params.id)) return
    const organization = organizationById(req.params.id)
    if (!organization) return sendError(res, 404, 'Organização não encontrada')
    res.json(presentOrganization(organization))
  })

  server.put('/organizations/:id', (req, res) => {
    if (!requireMembership(req, res, req.params.id, true)) return
    const organization = organizationById(req.params.id)
    if (!organization) return sendError(res, 404, 'Organização não encontrada')
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendError(res, 400, 'Corpo da requisição inválido')
    }
    const details = []
    const required = {
      displayName: 3,
      name: 3,
      initials: 1,
      phone: 8,
      address: 5,
      city: 2,
      description: 20,
    }
    const next = { ...organization }
    for (const [key, minimum] of Object.entries(required)) {
      const value = body[key]
      if (typeof value !== 'string' || value.trim().length < minimum) {
        details.push({ field: key, message: `Informe ${key} corretamente` })
      } else {
        next[key] = value.trim()
      }
    }
    const email = body.email ?? body.contactEmail
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      details.push({ field: 'email', message: 'Informe um e-mail válido' })
    } else {
      next.contactEmail = email.trim()
      next.email = email.trim()
    }
    const document = body.cnpj ?? body.document
    if (typeof document !== 'string' || digitsOnly(document).length !== 14) {
      details.push({ field: 'cnpj', message: 'Informe um CNPJ com 14 dígitos' })
    } else {
      next.cnpj = digitsOnly(document)
      next.document = next.cnpj
    }
    if (details.length) return sendError(res, 400, 'Validação falhou', details)

    const previousName = organization.name
    store
      .get('organizations')
      .find({ id: organization.id })
      .assign({ ...next, name: next.name || next.displayName })
      .write()
    const updated = organizationById(organization.id)
    if (organization.id === primaryOrganizationId(currentUserId(req))) {
      const profile = store.get('guardianProfile').value() ?? {}
      store
        .set('guardianProfile', {
          ...profile,
          displayName: updated.name,
          document: updated.cnpj,
          email: updated.contactEmail,
          phone: updated.phone,
          address: updated.address,
          city: updated.city,
          description: updated.description,
          userId: currentUserId(req),
        })
        .write()
      if (previousName !== updated.name) {
        store
          .get('pets')
          .filter({ organization: previousName })
          .each((pet) => {
            pet.organization = updated.name
            pet.organizationInitials = updated.initials
          })
          .write()
      }
    }
    res.json(presentOrganization(updated))
  })

  server.get('/organizations/:id/members', (req, res) => {
    if (!requireMembership(req, res, req.params.id)) return
    const data = store
      .get('memberships')
      .value()
      .filter((item) => item.organizationId === req.params.id && item.status === 'ATIVO')
      .map(presentMembership)
    res.json(list(data))
  })

  server.patch('/organizations/:id/members/:userId', (req, res) => {
    if (!requireMembership(req, res, req.params.id, true)) return
    const role = String(req.body?.role ?? '').toUpperCase()
    if (!['ADMIN', 'VOLUNTEER'].includes(role)) {
      return sendError(res, 400, 'Papel inválido')
    }
    const target = store
      .get('memberships')
      .value()
      .find(
        (item) =>
          item.organizationId === req.params.id &&
          item.userId === req.params.userId &&
          item.status === 'ATIVO',
      )
    if (!target) return sendError(res, 404, 'Membro não encontrado')
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = store
        .get('memberships')
        .value()
        .filter(
          (item) =>
            item.organizationId === req.params.id &&
            item.role === 'ADMIN' &&
            item.status === 'ATIVO',
        ).length
      if (admins <= 1) return sendError(res, 409, 'A organização precisa manter ao menos um ADMIN')
    }
    const updated = store.get('memberships').find({ id: target.id }).assign({ role }).write()
    res.json(presentMembership(updated))
  })

  server.delete('/organizations/:id/members/:userId', (req, res) => {
    if (!requireMembership(req, res, req.params.id, true)) return
    const target = store
      .get('memberships')
      .value()
      .find(
        (item) =>
          item.organizationId === req.params.id &&
          item.userId === req.params.userId &&
          item.status === 'ATIVO',
      )
    if (!target) return sendError(res, 404, 'Membro não encontrado')
    if (target.role === 'ADMIN') {
      const admins = store
        .get('memberships')
        .value()
        .filter(
          (item) =>
            item.organizationId === req.params.id &&
            item.role === 'ADMIN' &&
            item.status === 'ATIVO',
        ).length
      if (admins <= 1) return sendError(res, 409, 'A organização precisa manter ao menos um ADMIN')
    }
    store.get('memberships').find({ id: target.id }).assign({ status: 'REMOVIDO' }).write()
    res.status(204).end()
  })

  server.get('/organizations/:id/invitations', (req, res) => {
    if (!requireMembership(req, res, req.params.id)) return
    const data = store
      .get('invitations')
      .value()
      .filter((item) => item.organizationId === req.params.id)
      .map(presentInvitation)
    res.json(list(data))
  })

  server.post('/organizations/:id/invitations', (req, res) => {
    if (!requireMembership(req, res, req.params.id, true)) return
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase()
    const role = String(req.body?.role ?? '').toUpperCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['ADMIN', 'VOLUNTEER'].includes(role)) {
      return sendError(res, 400, 'Informe um e-mail e um papel válidos')
    }
    const existingUser = store
      .get('users')
      .value()
      .find((user) => user.email === email)
    if (
      existingUser &&
      store
        .get('memberships')
        .value()
        .some(
          (item) =>
            item.userId === existingUser.id &&
            item.organizationId === req.params.id &&
            item.status === 'ATIVO',
        )
    ) {
      return sendError(res, 409, 'Este usuário já pertence à organização')
    }
    if (
      store
        .get('invitations')
        .value()
        .some(
          (item) =>
            item.organizationId === req.params.id &&
            item.email === email &&
            item.status === 'PENDENTE' &&
            item.expiresAt >= new Date().toISOString(),
        )
    ) {
      return sendError(res, 409, 'Já existe um convite pendente para este e-mail')
    }
    const invitation = {
      id: `convite-${randomBytes(4).toString('hex')}`,
      organizationId: req.params.id,
      email,
      role,
      status: 'PENDENTE',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token: randomBytes(32).toString('base64url'),
    }
    store.get('invitations').push(invitation).write()
    res.status(201).json(presentInvitation(invitation))
  })

  server.delete('/organizations/:id/invitations/:invitationId', (req, res) => {
    if (!requireMembership(req, res, req.params.id, true)) return
    const invitation = store
      .get('invitations')
      .value()
      .find((item) => item.id === req.params.invitationId && item.organizationId === req.params.id)
    if (!invitation) return sendError(res, 404, 'Convite não encontrado')
    if (invitation.status === 'ACEITO') return sendError(res, 400, 'Este convite já foi usado')
    if (invitation.expiresAt < new Date().toISOString()) {
      store.get('invitations').find({ id: invitation.id }).assign({ status: 'EXPIRADO' }).write()
      return sendError(res, 410, 'Este convite expirou')
    }
    store.get('invitations').find({ id: invitation.id }).assign({ status: 'REVOGADO' }).write()
    res.status(204).end()
  })

  server.get('/invitations/:token', (req, res) => {
    const invitation = invitationByToken(req.params.token)
    if (!invitation) return sendError(res, 400, 'Convite inválido')
    if (invitation.status === 'REVOGADO') return sendError(res, 410, 'Este convite foi revogado')
    if (invitation.status === 'ACEITO') return sendError(res, 400, 'Este convite já foi usado')
    if (invitation.expiresAt < new Date().toISOString()) {
      store.get('invitations').find({ id: invitation.id }).assign({ status: 'EXPIRADO' }).write()
      return sendError(res, 410, 'Este convite expirou')
    }
    const organization = organizationById(invitation.organizationId)
    res.json({
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organization: organization
        ? { id: organization.id, name: organization.name, initials: organization.initials }
        : null,
      organizationName: organization?.name,
    })
  })

  server.post('/invitations/:token/accept', (req, res) => {
    const invitation = invitationByToken(req.params.token)
    if (!invitation) return sendError(res, 400, 'Convite inválido')
    if (invitation.status === 'ACEITO') return sendError(res, 400, 'Este convite já foi usado')
    if (invitation.status === 'REVOGADO') return sendError(res, 410, 'Este convite foi revogado')
    if (invitation.expiresAt < new Date().toISOString()) {
      store.get('invitations').find({ id: invitation.id }).assign({ status: 'EXPIRADO' }).write()
      return sendError(res, 410, 'Este convite expirou')
    }
    const userId = currentUserId(req)
    const user = demoUser(userId)
    if (!user || user.email.trim().toLowerCase() !== invitation.email) {
      return sendError(res, 403, 'Este convite pertence a outra conta')
    }
    const membership = {
      id: `membership-${invitation.id}`,
      userId,
      organizationId: invitation.organizationId,
      role: invitation.role,
      status: 'ATIVO',
      joinedAt: new Date().toISOString(),
      user: { id: userId, name: user.name, email: user.email },
    }
    const existing = store
      .get('memberships')
      .value()
      .find((item) => item.userId === userId && item.organizationId === invitation.organizationId)
    if (existing) {
      store
        .get('memberships')
        .find({ id: existing.id })
        .assign({ role: invitation.role, status: 'ATIVO', joinedAt: membership.joinedAt })
        .write()
    } else {
      store.get('memberships').push(membership).write()
    }
    store.get('invitations').find({ id: invitation.id }).assign({ status: 'ACEITO' }).write()
    const roles = Array.from(new Set([...(user.roles ?? ['ADOPTER']), 'GUARDIAN']))
    store.get('users').find({ id: userId }).assign({ roles }).write()
    res.json({ organization: organizationById(invitation.organizationId), membership })
  })

  server.get('/me/adoptions', (req, res) => {
    const userId = currentUserId(req)
    const ownedPetIds = new Set(organizationPets(userId).map(({ id }) => id))
    const data = store
      .get('requests')
      .value()
      .filter((request) => request.status === 'Aprovada')
      .filter((request) => request.userId === userId || ownedPetIds.has(request.petId))
      .map((request) => {
        const adopter = demoUser(request.userId) ?? {}
        const profile = getProfile(request.userId)
        const adoptionId = `ADO-${request.id}`
        return {
          id: adoptionId,
          adoptedAt: request.date,
          adopterId: request.userId,
          adopter: {
            id: request.userId,
            name: profile.name || adopter.name || 'Adotante',
            email: profile.email || adopter.email || '',
          },
          pet: findPet(request.petId),
          plan: store.get('followUpPlans').find({ adoptionId }).value() ?? null,
          checkIns: store
            .get('checkIns')
            .filter({ adoptionId })
            .value()
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        }
      })
    res.json(list(data))
  })

  server.post('/check-ins/:id/submit', async (req, res) => {
    const checkIn = store.get('checkIns').find({ id: req.params.id }).value()
    if (!checkIn) return sendError(res, 404, 'Check-in não encontrado')

    const adoption = store
      .get('requests')
      .value()
      .find((request) => `ADO-${request.id}` === checkIn.adoptionId)
    if (!adoption || adoption.userId !== currentUserId(req)) {
      return sendError(res, 403, 'Somente o adotante pode enviar este check-in')
    }
    if (!['PENDENTE', 'ATRASADO'].includes(checkIn.status)) {
      return sendError(res, 409, 'Este check-in não pode ser enviado neste estado')
    }

    let fields
    let files
    try {
      ;({ fields, files } = await parseMultipart(req))
    } catch {
      return sendError(res, 400, 'Upload inválido')
    }

    const report = typeof fields.report === 'string' ? fields.report.trim() : ''
    if (!report) {
      return sendError(res, 400, 'Informe o relato do check-in', [
        { field: 'report', message: 'Escreva um relato sobre o acompanhamento.' },
      ])
    }

    const photos = (files ?? []).filter(({ field }) => field === 'files')
    if (photos.length > CHECK_IN_MAX_PHOTOS) {
      return sendError(res, 400, 'Upload inválido', [
        { field: 'files', message: 'Escolha no máximo 5 fotos.' },
      ])
    }
    const invalidType = photos.find((file) => !CHECK_IN_PHOTO_TYPES.includes(file.contentType))
    if (invalidType) {
      return sendError(res, 400, 'Upload inválido', [
        { field: 'files', message: 'Use fotos nos formatos JPEG, PNG ou WebP.' },
      ])
    }
    const tooLarge = photos.find((file) => file.buffer.length > CHECK_IN_MAX_PHOTO_BYTES)
    if (tooLarge) {
      return sendError(res, 400, 'Upload inválido', [
        { field: 'files', message: 'Cada foto deve ter no máximo 5 MB.' },
      ])
    }

    const photoIds = photos.map((file, index) => {
      const object = {
        id: `obj-${checkIn.id}-${Date.now()}-${index}`,
        key: `check-ins/${checkIn.id}/${file.filename}`,
        contentType: file.contentType,
        sizeBytes: file.buffer.length,
        resourceType: 'CHECK_IN',
        resourceId: checkIn.id,
        ownerId: adoption.userId,
        createdAt: new Date().toISOString(),
        // O mock não tem bucket: guarda os bytes para a URL assinada simulada.
        dataUrl: `data:${file.contentType};base64,${file.buffer.toString('base64')}`,
      }
      store.get('storageObjects').push(object).write()
      return object.id
    })

    const updated = {
      ...checkIn,
      status: 'ENVIADO',
      submittedAt: new Date().toISOString(),
      report,
      photos: photoIds,
      reviewerComment: null,
      reviewedAt: null,
    }
    store.get('checkIns').find({ id: checkIn.id }).assign(updated).write()
    res.json(updated)
  })

  server.post('/check-ins/:id/photos/:photoId/url', (req, res) => {
    const checkIn = store.get('checkIns').find({ id: req.params.id }).value()
    if (!checkIn) return sendError(res, 404, 'Check-in não encontrado')

    const adoption = store
      .get('requests')
      .value()
      .find((request) => `ADO-${request.id}` === checkIn.adoptionId)
    const userId = currentUserId(req)
    const isAdopter = adoption?.userId === userId
    const isMember = !isAdopter && organizationsForUser(userId).length > 0
    if (!isAdopter && !isMember) {
      return sendError(res, 403, 'Sem acesso às fotos deste check-in')
    }
    if (!checkIn.photos.includes(req.params.photoId)) {
      return sendError(res, 404, 'Foto não encontrada')
    }
    const object = store
      .get('storageObjects')
      .find({
        id: req.params.photoId,
        resourceType: 'CHECK_IN',
        resourceId: checkIn.id,
      })
      .value()
    if (!object) return sendError(res, 404, 'Foto não encontrada')

    res.json({
      url: `/files/${encodeURIComponent(object.id)}?token=mock-assinado`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  })

  server.get('/files/:id', (req, res) => {
    if (typeof req.query.token !== 'string' || !req.query.token) {
      return sendError(res, 403, 'Sem acesso ao arquivo')
    }
    const object = store.get('storageObjects').find({ id: req.params.id }).value()
    if (!object || typeof object.dataUrl !== 'string') {
      return sendError(res, 404, 'Arquivo não encontrado')
    }
    const encoded = object.dataUrl.split(',')[1] ?? ''
    res.type(object.contentType || 'application/octet-stream').send(Buffer.from(encoded, 'base64'))
  })

  server.get('/me/received-requests', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const ownedPets = organizationPets(userId, activeOrganizationId(req))
    const petIds = new Set(ownedPets.map(({ id }) => id))
    const requestedPet = typeof req.query.petId === 'string' ? req.query.petId : ''
    const requestedStage = typeof req.query.stage === 'string' ? req.query.stage : 'all'

    const stageOf = (request) => {
      if (request.status === 'Enviada') return 'new'
      if (request.status === 'Em análise') {
        return request.interview?.completed ? 'interview-done' : 'interview'
      }
      if (request.status === 'Aprovada') return 'approved'
      return 'closed'
    }

    const scoped = store
      .get('requests')
      .value()
      .filter(({ petId }) => petIds.has(petId) && (!requestedPet || petId === requestedPet))
      .reverse()
    const counters = {
      all: scoped.length,
      new: 0,
      interview: 0,
      'interview-done': 0,
      approved: 0,
      closed: 0,
    }
    scoped.forEach((request) => {
      counters[stageOf(request)] += 1
    })
    const selected =
      requestedStage === 'all'
        ? scoped
        : scoped.filter((request) => stageOf(request) === requestedStage)
    const requests = selected.map((request) => withReceivedRequest(request, userId))
    res.json({
      ...list(requests),
      counters,
      pets: ownedPets.map((pet) => ({ ...pet, distance: null, distanceKm: null })),
    })
  })

  server.get('/me/received-requests/:id', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const petIds = new Set(organizationPets(userId).map(({ id }) => id))
    const request = store.get('requests').find({ id: req.params.id }).value()
    if (!request || !petIds.has(request.petId))
      return sendError(res, 404, 'Solicitação não encontrada')
    res.json(withReceivedRequest(request, userId))
  })

  const isFutureDate = (value) => {
    if (typeof value !== 'string' || isBlank(value)) return false
    const date = new Date(value)
    return !Number.isNaN(date.getTime()) && date.getTime() > Date.now()
  }

  server.post('/me/received-requests/:id/interview', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const petIds = new Set(organizationPets(userId).map(({ id }) => id))
    const request = store.get('requests').find({ id: req.params.id }).value()
    if (!request || !petIds.has(request.petId))
      return sendError(res, 404, 'Solicitação não encontrada')
    if (request.status !== 'Em análise') {
      return sendError(
        res,
        409,
        'Só é possível agendar uma entrevista com a solicitação em análise.',
      )
    }
    if (request.interview?.completed) {
      return sendError(res, 409, 'A entrevista desta solicitação já foi realizada.')
    }
    const proposedSlots = Array.isArray(req.body?.proposedSlots) ? req.body.proposedSlots : []
    const details = []
    if (proposedSlots.length === 0 || proposedSlots.length > 3) {
      details.push({
        field: 'proposedSlots',
        message: 'Proponha de 1 a 3 horários para a entrevista.',
      })
    }
    if (proposedSlots.some((slot) => !isFutureDate(slot))) {
      details.push({
        field: 'proposedSlots',
        message: 'Todos os horários precisam ser datas futuras.',
      })
    }
    if (details.length) return sendError(res, 400, 'Validação falhou', details)
    const type = INTERVIEW_TYPES.includes(req.body?.type) ? req.body.type : 'Entrevista online'
    const interview = {
      type,
      proposedSlots,
      status: 'AGENDADA',
      completed: false,
      scheduledAt: new Date().toISOString(),
    }
    const updated = { ...request, interview }
    store.get('requests').find({ id: request.id }).assign(updated).write()
    res.json(withReceivedRequest(updated, userId))
  })

  server.post('/me/received-requests/:id/interview/complete', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const petIds = new Set(organizationPets(userId).map(({ id }) => id))
    const request = store.get('requests').find({ id: req.params.id }).value()
    if (!request || !petIds.has(request.petId))
      return sendError(res, 404, 'Solicitação não encontrada')
    if (!request.interview) {
      return sendError(res, 400, 'Nenhuma entrevista foi agendada para esta solicitação.')
    }
    if (!['Em análise', 'Aprovada'].includes(request.status)) {
      return sendError(res, 409, 'Esta solicitação não está em etapa de entrevista.')
    }
    const interview = {
      ...request.interview,
      status: 'REALIZADA',
      completed: true,
      completedAt: new Date().toISOString(),
    }
    const updated = { ...request, interview }
    store.get('requests').find({ id: request.id }).assign(updated).write()
    res.json(withReceivedRequest(updated, userId))
  })

  server.post('/me/received-requests/:id/transitions', (req, res) => {
    if (!requireGuardian(req, res)) return
    const userId = currentUserId(req)
    const petIds = new Set(organizationPets(userId).map(({ id }) => id))
    const request = store.get('requests').find({ id: req.params.id }).value()
    if (!request || !petIds.has(request.petId))
      return sendError(res, 404, 'Solicitação não encontrada')
    const to = String(req.body?.to ?? '').toUpperCase()
    const status = ORGANIZATION_REQUEST_TRANSITIONS[to]
    if (!status) return sendError(res, 400, 'Transição não suportada')

    const role = demoRole(req)
    if (role === 'VOLUNTEER' && status === 'Aprovada') {
      return sendError(res, 403, 'Apenas administradores podem aprovar solicitações.')
    }

    if (status === 'Aprovada' && request.interview?.completed !== true) {
      return sendError(
        res,
        400,
        'O agendamento da etapa precisa estar marcado como realizado antes de aprovar.',
        [{ field: 'interview', message: 'Marque a entrevista como realizada antes de aprovar.' }],
      )
    }

    const allowed =
      (request.status === 'Enviada' && ['Em análise', 'Recusada'].includes(status)) ||
      (request.status === 'Em análise' && ['Aprovada', 'Recusada'].includes(status))
    if (!allowed)
      return sendError(
        res,
        409,
        `Não é possível alterar uma solicitação com status "${request.status}" para "${status}"`,
      )
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    if (status === 'Recusada' && reason.length < 10) {
      return sendError(res, 400, 'Informe o motivo da recusa', [
        { field: 'reason', message: 'O motivo deve ter pelo menos 10 caracteres.' },
      ])
    }
    const messages = {
      'Em análise': 'A instituição iniciou a análise da sua solicitação.',
      Aprovada: 'Sua solicitação foi aprovada pela instituição.',
      Recusada: reason
        ? `A instituição encerrou esta solicitação: ${reason}`
        : 'A instituição encerrou esta solicitação.',
    }
    const updated = {
      ...request,
      status,
      message: messages[status],
      ...(status === 'Recusada' && reason ? { rejectionReason: reason } : {}),
    }
    store.get('requests').find({ id: request.id }).assign(updated).write()
    res.json(withReceivedRequest(updated, userId))
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
    const userId = currentUserId(req)
    const requests = myRequests(userId)
      .reverse()
      .map((request) => ({
        ...withPet(request),
        unreadMessageCount: unreadChatCount(request.id, userId),
      }))
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

  // --- Chat da solicitação (API simulada) --------------------------------------
  server.get('/requests/:id/messages', (req, res) => {
    const userId = currentUserId(req)
    const adoptionRequest = store.get('requests').find({ id: req.params.id }).value()
    if (!adoptionRequest) return sendError(res, 404, 'Solicitação não encontrada')
    if (!isChatParticipant(adoptionRequest, userId)) {
      return sendError(res, 403, 'Somente os participantes podem acessar esta conversa')
    }
    if (Object.keys(req.query).some((key) => key !== 'cursor')) {
      return sendError(res, 400, 'Parâmetro desconhecido', [
        { field: 'query', message: 'Apenas cursor é aceito' },
      ])
    }
    const allMessages = messagesForRequest(adoptionRequest.id)
    const cursor = req.query.cursor
    let end = allMessages.length
    if (cursor !== undefined) {
      if (typeof cursor !== 'string') {
        return sendError(res, 400, 'Cursor inválido', [
          { field: 'cursor', message: 'Informe um cursor válido' },
        ])
      }
      end = allMessages.findIndex(({ id }) => id === cursor)
      if (end < 0) {
        return sendError(res, 400, 'Cursor inválido', [
          { field: 'cursor', message: 'O cursor não pertence a esta conversa' },
        ])
      }
    }
    const start = Math.max(0, end - 20)
    const page = allMessages.slice(start, end)
    res.json({
      data: page.map((message) => presentChatMessage(message, userId)),
      unreadCount: unreadChatCount(adoptionRequest.id, userId),
      nextCursor: start > 0 ? page[0].id : null,
    })
  })

  server.post('/requests/:id/messages', (req, res) => {
    const userId = currentUserId(req)
    const adoptionRequest = store.get('requests').find({ id: req.params.id }).value()
    if (!adoptionRequest) return sendError(res, 404, 'Solicitação não encontrada')
    if (!isChatParticipant(adoptionRequest, userId)) {
      return sendError(res, 403, 'Somente os participantes podem enviar mensagens')
    }
    if (FINAL_REQUEST_STATUSES.includes(adoptionRequest.status)) {
      return sendError(res, 409, 'O chat está bloqueado para solicitações encerradas')
    }
    const body = req.body
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== 'body') ||
      typeof body.body !== 'string' ||
      !body.body.trim() ||
      body.body.length > 2000
    ) {
      return sendError(res, 400, 'Mensagem inválida', [
        { field: 'body', message: 'A mensagem deve ter entre 1 e 2000 caracteres' },
      ])
    }
    const nextId =
      store
        .get('chatMessages')
        .value()
        .reduce((max, message) => Math.max(max, Number(message.id.replace(/\D/g, '')) || 0), 0) + 1
    const message = {
      id: `MSG-${String(nextId).padStart(4, '0')}`,
      requestId: adoptionRequest.id,
      authorId: userId,
      body: body.body,
      createdAt: new Date().toISOString(),
      readAt: null,
    }
    store.get('chatMessages').push(message).write()
    res.status(201).json(presentChatMessage(message, userId))
  })

  server.patch('/requests/:id/messages/read', (req, res) => {
    const userId = currentUserId(req)
    const adoptionRequest = store.get('requests').find({ id: req.params.id }).value()
    if (!adoptionRequest) return sendError(res, 404, 'Solicitação não encontrada')
    if (!isChatParticipant(adoptionRequest, userId)) {
      return sendError(res, 403, 'Somente os participantes podem marcar mensagens como lidas')
    }
    const readAt = new Date().toISOString()
    store
      .get('chatMessages')
      .filter({ requestId: adoptionRequest.id })
      .each((message) => {
        if (message.authorId !== userId && !message.readAt) message.readAt = readAt
      })
      .write()
    res.status(204).end()
  })

  // --- Favoritos ---------------------------------------------------------------
  const myFavorites = (userId) => store.get('favorites').filter({ userId }).value()

  server.get('/me/favorites/ids', (req, res) =>
    res.json(list(myFavorites(currentUserId(req)).map((f) => f.petId))),
  )

  // Mesmo resumo/paginação da API real (#51); o frontend usa o mesmo schema Zod.
  const presentFavoritePet = (pet) => {
    const { distanceKm, distance } = presentPet(pet)
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      ageLabel: pet.ageLabel,
      size: pet.size,
      sex: pet.sex,
      city: pet.city,
      image: pet.image,
      summary: pet.summary,
      traits: pet.traits,
      vaccinated: pet.vaccinated,
      neutered: pet.neutered,
      organization: pet.organization,
      status: pet.status || 'DISPONIVEL',
      distanceKm,
      distance,
    }
  }

  server.get('/me/favorites', (req, res) => {
    const { page, limit, ...unknown } = req.query
    const details = Object.keys(unknown).map((field) => ({
      field,
      message: 'Parâmetro desconhecido',
    }))
    const pageNumber = positiveInt(page, 'page', details, 1)
    const limitNumber = positiveInt(limit, 'limit', details, DEFAULT_LIMIT)
    if (limitNumber > MAX_LIMIT)
      details.push({ field: 'limit', message: `limit máximo é ${MAX_LIMIT}` })
    if (details.length) return sendError(res, 400, 'Parâmetros de consulta inválidos', details)

    const pets = myFavorites(currentUserId(req))
      .map((favorite) => findPet(favorite.petId))
      .filter(Boolean)
      .map(presentFavoritePet)
    const start = (pageNumber - 1) * limitNumber
    res.json({ data: pets.slice(start, start + limitNumber), total: pets.length })
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

  // --- Filtros salvos (API simulada) -------------------------------------------
  server.get('/me/saved-filters', (req, res) => {
    const data = mySavedFilters(currentUserId(req)).map(presentSavedFilter)
    res.json({ data, total: data.length })
  })

  server.post('/me/saved-filters', (req, res) => {
    const details = validateSavedFilter(req.body)
    if (details.length) return sendError(res, 400, 'Critérios de busca inválidos', details)

    const userId = currentUserId(req)
    if (mySavedFilters(userId).length >= 10) {
      return sendError(res, 409, 'Você atingiu o limite de 10 buscas salvas')
    }

    const nextId =
      store
        .get('savedFilters')
        .value()
        .reduce((max, filter) => Math.max(max, Number(filter.id) || 0), 0) + 1
    const savedFilter = {
      id: String(nextId),
      userId,
      name: req.body.name.trim(),
      criteria: req.body.criteria,
      active: req.body.active,
      createdAt: new Date().toISOString(),
    }
    store.get('savedFilters').push(savedFilter).write()
    res.status(201).json(presentSavedFilter(savedFilter))
  })

  server.patch('/me/saved-filters/:id', (req, res) => {
    const userId = currentUserId(req)
    const savedFilter = mySavedFilters(userId).find(({ id }) => id === req.params.id)
    if (!savedFilter) return sendError(res, 404, 'Busca salva não encontrada')

    const details = validateSavedFilter(req.body, true)
    if (details.length) return sendError(res, 400, 'Atualização inválida', details)

    const updated = {
      ...savedFilter,
      ...req.body,
      name: req.body.name?.trim() ?? savedFilter.name,
    }
    store.get('savedFilters').find({ id: savedFilter.id, userId }).assign(updated).write()
    res.json(presentSavedFilter(updated))
  })

  server.delete('/me/saved-filters/:id', (req, res) => {
    const userId = currentUserId(req)
    const savedFilter = mySavedFilters(userId).find(({ id }) => id === req.params.id)
    if (!savedFilter) return sendError(res, 404, 'Busca salva não encontrada')
    store.get('savedFilters').remove({ id: savedFilter.id, userId }).write()
    res.status(204).end()
  })

  // --- Notificações (API simulada) ----------------------------------------------
  const myNotifications = (userId) =>
    store
      .get('notifications')
      .filter({ userId })
      .value()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))

  const myNotificationPreferences = (userId) => {
    const saved = store.get('notificationPreferences').filter({ userId }).value()
    if (saved.length) return saved

    const defaults = NOTIFICATION_TYPES.map((type) => ({
      userId,
      type,
      inApp: true,
      email: DEFAULT_EMAIL_NOTIFICATION_TYPES.includes(type),
    }))
    store
      .get('notificationPreferences')
      .push(...defaults)
      .write()
    return defaults
  }

  server.get('/me/notifications', (req, res) => {
    const userId = currentUserId(req)
    const unreadParam = req.query.unread
    if (unreadParam !== undefined && !['true', 'false'].includes(unreadParam)) {
      return sendError(res, 400, 'Parâmetro unread inválido', [
        { field: 'unread', message: 'Use true ou false.' },
      ])
    }

    const all = myNotifications(userId)
    const unreadCount = all.filter((notification) => !notification.readAt).length
    const matching =
      unreadParam === 'true' ? all.filter((notification) => !notification.readAt) : all
    const cursor = req.query.cursor
    const cursorIndex =
      cursor === undefined ? -1 : matching.findIndex((notification) => notification.id === cursor)
    if (cursor !== undefined && cursorIndex < 0) {
      return sendError(res, 400, 'Cursor inválido', [
        { field: 'cursor', message: 'O cursor não pertence a esta lista.' },
      ])
    }

    const page = matching.slice(cursorIndex + 1, cursorIndex + 1 + 5)
    const hasMore = cursorIndex + 1 + page.length < matching.length
    res.json({
      data: page.map(({ userId: _userId, ...notification }) => notification),
      unreadCount,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    })
  })

  server.patch('/me/notifications/read-all', (req, res) => {
    const userId = currentUserId(req)
    const readAt = new Date().toISOString()
    store
      .get('notifications')
      .filter({ userId })
      .each((notification) => {
        if (!notification.readAt) notification.readAt = readAt
      })
      .write()
    res.status(204).end()
  })

  server.patch('/me/notifications/:id/read', (req, res) => {
    const userId = currentUserId(req)
    const notification = store.get('notifications').find({ id: req.params.id, userId }).value()
    if (!notification) return sendError(res, 404, 'Notificação não encontrada')

    store
      .get('notifications')
      .find({ id: notification.id, userId })
      .assign({ readAt: notification.readAt ?? new Date().toISOString() })
      .write()
    res.status(204).end()
  })

  server.get('/me/notification-preferences', (req, res) => {
    const preferences = myNotificationPreferences(currentUserId(req)).map(
      ({ userId: _userId, ...preference }) => preference,
    )
    res.json({ data: preferences })
  })

  server.put('/me/notification-preferences', (req, res) => {
    const body = req.body?.data
    if (!Array.isArray(body)) {
      return sendError(res, 400, 'Corpo da requisição inválido', [
        { field: 'data', message: 'Envie a lista completa de preferências.' },
      ])
    }

    const details = []
    const seen = new Set()
    for (const [index, preference] of body.entries()) {
      if (
        !preference ||
        !NOTIFICATION_TYPES.includes(preference.type) ||
        typeof preference.inApp !== 'boolean' ||
        typeof preference.email !== 'boolean' ||
        seen.has(preference.type)
      ) {
        details.push({
          field: `data.${index}`,
          message: 'Informe um tipo válido e os canais inApp/email sem duplicar tipos.',
        })
      } else {
        seen.add(preference.type)
      }
    }
    if (seen.size !== NOTIFICATION_TYPES.length) {
      details.push({
        field: 'data',
        message: 'Inclua exatamente uma preferência para cada tipo de notificação.',
      })
    }
    if (details.length) return sendError(res, 400, 'Validação falhou', details)

    const userId = currentUserId(req)
    const stored = body.map((preference) => ({ ...preference, userId }))
    store.get('notificationPreferences').remove({ userId }).write()
    store
      .get('notificationPreferences')
      .push(...stored)
      .write()
    res.json({ data: body })
  })

  // --- Prontuário médico: leitura, CRUD e upload de anexos ----------------------
  server.get('/pets/:petId/medical-record', (req, res) => {
    const pet = findPet(req.params.petId)
    if (!pet) return sendError(res, 404, 'Pet não encontrado')
    return res.json(presentMedicalRecord(req, pet, medicalRecordOf(pet.id)))
  })

  server.put('/pets/:petId/medical-record/neutering', (req, res) => {
    const pet = medicalPetOrError(req, res)
    if (!pet) return
    const body = req.body ?? {}
    const details = []
    if (typeof body.done !== 'boolean')
      details.push({ field: 'done', message: 'done deve ser booleano' })
    if (body.done && !isIsoDate(body.date))
      details.push({ field: 'date', message: 'Informe a data da castração.' })
    if (!body.done && body.date)
      details.push({
        field: 'date',
        message: 'A data só pode ser informada quando a castração foi realizada.',
      })
    if (details.length) return sendError(res, 400, 'Validação falhou', details)
    const userId = currentUserId(req)
    const record = ensureMedicalRecord(pet.id, userId)
    record.neutering = {
      ...record.neutering,
      done: body.done,
      date: body.done ? body.date : null,
      updatedAt: nowIso(),
      updatedById: userId,
    }
    record.updatedAt = nowIso()
    record.updatedById = userId
    store.get('medicalRecords').write()
    return res.json(record.neutering)
  })

  for (const [routeKind, collectionKey] of Object.entries(MEDICAL_COLLECTIONS)) {
    const base = `/pets/:petId/medical-record/${routeKind}`

    server.post(base, (req, res) => {
      const pet = medicalPetOrError(req, res)
      if (!pet) return
      const details = validateMedicalItem(collectionKey, req.body)
      if (details.length) return sendError(res, 400, 'Validação falhou', details)
      const userId = currentUserId(req)
      const record = ensureMedicalRecord(pet.id, userId)
      const timestamp = nowIso()
      const item = {
        id: makeId(routeKind.slice(0, 3)),
        ...medicalFields(collectionKey, req.body),
        createdAt: timestamp,
        createdById: userId,
        updatedAt: timestamp,
        updatedById: userId,
      }
      record[collectionKey].push(item)
      record.updatedAt = timestamp
      record.updatedById = userId
      store.get('medicalRecords').write()
      return res.status(201).json(item)
    })

    server.put(`${base}/:itemId`, (req, res) => {
      const pet = medicalPetOrError(req, res)
      if (!pet) return
      const details = validateMedicalItem(collectionKey, req.body)
      if (details.length) return sendError(res, 400, 'Validação falhou', details)
      const record = medicalRecordOf(pet.id)
      const index = record?.[collectionKey].findIndex(({ id }) => id === req.params.itemId) ?? -1
      if (index < 0) return sendError(res, 404, 'Item não encontrado neste prontuário')
      const userId = currentUserId(req)
      const timestamp = nowIso()
      const item = {
        ...record[collectionKey][index],
        ...medicalFields(collectionKey, req.body),
        updatedAt: timestamp,
        updatedById: userId,
      }
      record[collectionKey][index] = item
      record.updatedAt = timestamp
      record.updatedById = userId
      store.get('medicalRecords').write()
      return res.json(item)
    })

    server.delete(`${base}/:itemId`, (req, res) => {
      const pet = medicalPetOrError(req, res)
      if (!pet) return
      const record = medicalRecordOf(pet.id)
      const key = collectionKey
      const removed = record?.[key].find(({ id }) => id === req.params.itemId)
      if (!record || !removed) return sendError(res, 404, 'Item não encontrado neste prontuário')
      if (key === 'exams' && removed.attachment) {
        store.get('storageObjects').remove({ id: removed.attachment }).write()
      }
      record[key] = record[key].filter(({ id }) => id !== req.params.itemId)
      store.get('medicalRecords').write()
      return res.status(204).end()
    })
  }

  server.post('/storage/objects', async (req, res) => {
    const userId = currentUserId(req)
    let fields
    let file
    try {
      ;({ fields, file } = await parseMultipart(req))
    } catch {
      return sendError(res, 400, 'Upload inválido')
    }
    if (fields.scope !== 'medicalExam' || fields.resourceType !== 'MEDICAL_EXAM') {
      return sendError(res, 403, 'Sem permissão para anexar arquivos a este exame')
    }
    const record = store
      .get('medicalRecords')
      .value()
      .find((item) => (item.exams ?? []).some((exam) => exam.id === fields.resourceId))
    const pet = record ? findPet(record.petId) : null
    if (!isMedicalMember(req, pet)) {
      return sendError(res, 403, 'Sem permissão para anexar arquivos a este exame')
    }
    if (!file) return sendError(res, 400, 'Nenhum arquivo enviado')
    const object = {
      id: makeId('obj'),
      key: `medical-exams/${fields.resourceId}/${file.filename}`,
      contentType: file.contentType,
      sizeBytes: file.buffer.length,
      resourceType: 'MEDICAL_EXAM',
      resourceId: fields.resourceId,
      ownerId: userId,
      createdAt: nowIso(),
    }
    store.get('storageObjects').push(object).write()
    const exam = record.exams.find(({ id }) => id === fields.resourceId)
    exam.attachment = object.id
    store.get('medicalRecords').write()
    return res.status(201).json({
      data: [
        {
          ...object,
          url: `/files/${object.id}?token=mock-assinado`,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
      ],
      total: 1,
    })
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
