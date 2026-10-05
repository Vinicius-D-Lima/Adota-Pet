import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jsonServer from 'json-server'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SEED_PATH = path.join(here, 'db.seed.json')
export const DB_PATH = path.join(here, 'db.json')

const DEMO_USER_ID = 'demo'
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

const STATUS_NAMES = {
  400: 'Bad Request',
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

  const demoUser = () => store.get('users').find({ id: DEMO_USER_ID }).value()
  const findPet = (id) => store.get('pets').find({ id }).value()
  const myRequests = () => store.get('requests').filter({ userId: DEMO_USER_ID }).value()
  const withPet = (request) => ({
    ...request,
    pet: findPet(request.petId) ?? null,
  })
  const getProfile = () => {
    const profile = store.get('profile').value() ?? {}
    const missingFields = missingProfileFields(profile)
    return { ...profile, isComplete: missingFields.length === 0, missingFields }
  }

  const presentPet = (pet) => {
    const user = demoUser()
    const hasCoords = user && typeof pet.lat === 'number' && typeof pet.lng === 'number'
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
  server.get('/me', (_req, res) => {
    const { lat: _lat, lng: _lng, ...user } = demoUser()
    res.json(user)
  })

  server.get('/me/adopter-profile', (_req, res) => res.json(getProfile()))

  server.put('/me/adopter-profile', (req, res) => {
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

    const next = { ...store.get('profile').value(), ...normalized, userId: DEMO_USER_ID }
    store.set('profile', next).write()
    res.json(getProfile())
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
    if (!getProfile().isComplete) {
      return sendError(
        res,
        422,
        'Complete seu perfil de adotante antes de solicitar uma adoção',
        getProfile().missingFields.map((field) => ({
          field,
          message: 'Campo obrigatório do perfil não preenchido ou inválido',
        })),
      )
    }
    const duplicate = myRequests().some(
      (request) => request.petId === petId && ACTIVE_STATUSES.includes(request.status),
    )
    if (duplicate) return sendError(res, 409, 'Você já possui uma solicitação ativa para este pet')

    const lastNumber = store
      .get('requests')
      .value()
      .reduce((max, { id }) => Math.max(max, Number(/^SOL-(\d+)$/.exec(id)?.[1] ?? 0)), 1042)
    const request = {
      id: `SOL-${String(lastNumber + 1).padStart(4, '0')}`,
      userId: DEMO_USER_ID,
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

  server.get('/me/requests', (_req, res) => {
    const requests = myRequests().reverse().map(withPet)
    res.json(list(requests))
  })

  server.get('/requests/:id', (req, res) => {
    const request = myRequests().find(({ id }) => id === req.params.id)
    if (!request) return sendError(res, 404, 'Solicitação não encontrada')
    res.json(withPet(request))
  })

  server.post('/requests/:id/transitions', (req, res) => {
    const request = myRequests().find(({ id }) => id === req.params.id)
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
  const myFavorites = () => store.get('favorites').filter({ userId: DEMO_USER_ID }).value()

  server.get('/me/favorites/ids', (_req, res) => res.json(list(myFavorites().map((f) => f.petId))))

  server.get('/me/favorites', (_req, res) => {
    const pets = myFavorites()
      .map((favorite) => findPet(favorite.petId))
      .filter(Boolean)
      .map(presentPet)
    res.json(list(pets))
  })

  server.put('/me/favorites/:petId', (req, res) => {
    const { petId } = req.params
    if (!findPet(petId)) return sendError(res, 404, 'Pet não encontrado')
    if (!myFavorites().some((favorite) => favorite.petId === petId)) {
      const nextId =
        store
          .get('favorites')
          .value()
          .reduce((max, { id }) => Math.max(max, id), 0) + 1
      store
        .get('favorites')
        .push({
          id: nextId,
          userId: DEMO_USER_ID,
          petId,
          createdAt: new Date().toISOString(),
        })
        .write()
    }
    res.status(204).end()
  })

  server.delete('/me/favorites/:petId', (req, res) => {
    store.get('favorites').remove({ userId: DEMO_USER_ID, petId: req.params.petId }).write()
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
