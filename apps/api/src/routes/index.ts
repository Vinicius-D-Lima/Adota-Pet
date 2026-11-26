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
import { organizationsRouter } from './organizations.js'
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

  // A reputação é pública; monte antes da autenticação de /organizations.
  apiRouter.use(reputationRouter)

  // Os routers são montados na raiz de /api, então um `router.use(requireAuth)`
  // dentro deles também protegeria /api/pets (público). Em vez disso, exigimos JWT
  // apenas nos prefixos privados conhecidos (#4/#5). Paths desconhecidos seguem
  // para o 404 abaixo, e /api/auth/* já é montado antes de /api em app.ts.
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
  apiRouter.use((req, res, next) => {
    const isPrivate = PRIVATE_PREFIXES.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`),
    )
    if (isPrivate) return requireAuth(req, res, next)
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

  // Rotas desconhecidas respondem no formato do contrato (#47).
  // Erros (Zod, parser, exceções) são tratados pelo middleware global em app.ts.
  apiRouter.use((req, res) => {
    const resource = req.path.split('/')[1]
    sendError(res, 404, resource === 'pets' ? 'Pet não encontrado' : 'Recurso não encontrado')
  })

  return apiRouter
}

export const apiRouter = createApiRouter()
