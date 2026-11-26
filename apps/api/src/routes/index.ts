import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { sendError } from '../http.js'
import type { MatchingStrategy } from '../matching.js'
import { adoptionsRouter } from './adoptions.js'
import { checkInsRouter } from './checkIns.js'
import { favoritesRouter } from './favorites.js'
import { medicalRecordsRouter } from './medicalRecords.js'
import { notificationsRouter } from './notifications.js'
import { organizationRouter } from './organization.js'
import { organizationsRouter, publicInvitationRouter } from './organizations.js'
import { createPetsRouter } from './pets.js'
import { profileRouter } from './profile.js'
import { requestsRouter } from './requests.js'
import { reportsRouter } from './reports.js'
import { reputationRouter, reviewsRouter } from './reviews.js'
import { savedFiltersRouter } from './savedFilters.js'
import { storageRouter } from './storage.js'

export interface ApiRouterOptions {
  /** Estratégia de matching injetável (MATCH-07). */
  matchingStrategy?: MatchingStrategy
}

/**
 * API do Adota-Pet: mesmo contrato do mock-server, persistida no PostgreSQL.
 * A composição é uma factory para permitir injetar dependências nos testes.
 */
export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const apiRouter = Router()

  // Rotas públicas registradas antes do middleware de autenticação (#41).
  apiRouter.use(reputationRouter)
  apiRouter.use(publicInvitationRouter)

  // Os routers são montados na raiz de /api, então um `router.use(requireAuth)`
  // dentro deles também protegeria /api/pets (público). Em vez disso, exigimos JWT
  // apenas nos prefixos privados conhecidos (#4/#5). Paths desconhecidos seguem
  // para a negação abaixo, e /api/auth/* já é montado antes de /api em app.ts.
  const PRIVATE_PREFIXES = [
    '/me',
    '/requests',
    '/adoptions',
    '/organizations',
    '/reviews',
    '/invitations',
    '/reports',
    '/moderation',
    '/check-ins',
  ] as const
  const isPrivatePath = (path: string) =>
    PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  apiRouter.use((req, res, next) => {
    if (isPrivatePath(req.path)) return requireAuth(req, res, next)
    return next()
  })
  apiRouter.use(checkInsRouter)
  apiRouter.use(organizationsRouter)
  apiRouter.use(profileRouter)
  apiRouter.use(adoptionsRouter)
  apiRouter.use(reviewsRouter)
  apiRouter.use(organizationsRouter)
  apiRouter.use(organizationRouter)
  apiRouter.use(createPetsRouter(options.matchingStrategy))
  apiRouter.use(medicalRecordsRouter)
  apiRouter.use(requestsRouter)
  apiRouter.use(reportsRouter)
  apiRouter.use(favoritesRouter)
  apiRouter.use(savedFiltersRouter)
  apiRouter.use(notificationsRouter)
  apiRouter.use(storageRouter)

  // RBAC-08: deny by default. Um path privado sem rota declarada não cai no
  // 404 público — a requisição já autenticada é negada por falta de regra.
  apiRouter.use((req, res, next) => {
    if (isPrivatePath(req.path)) {
      return sendError(res, 403, 'Você não tem permissão para acessar este recurso')
    }
    return next()
  })

  // Rotas desconhecidas respondem no formato do contrato (#47).
  // Erros (Zod, parser, exceções) são tratados pelo middleware global em app.ts.
  apiRouter.use((req, res) => {
    const resource = req.path.split('/')[1]
    sendError(res, 404, resource === 'pets' ? 'Pet não encontrado' : 'Recurso não encontrado')
  })

  return apiRouter
}

export const apiRouter = createApiRouter()
