import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { sendError } from '../http.js'
import { favoritesRouter } from './favorites.js'
import { notificationsRouter } from './notifications.js'
import { organizationRouter } from './organization.js'
import { petsRouter } from './pets.js'
import { profileRouter } from './profile.js'
import { requestsRouter } from './requests.js'
import { savedFiltersRouter } from './savedFilters.js'
import { storageRouter } from './storage.js'

/** API do Adota-Pet: mesmo contrato do mock-server, persistida no PostgreSQL. */
export const apiRouter = Router()

// Os routers são montados na raiz de /api, então um `router.use(requireAuth)`
// dentro deles também protegeria /api/pets (público). Em vez disso, exigimos JWT
// apenas nos prefixos privados conhecidos (#4/#5). Paths desconhecidos seguem
// para o 404 abaixo, e /api/auth/* já é montado antes de /api em app.ts.
const PRIVATE_PREFIXES = ['/me', '/requests'] as const
apiRouter.use((req, res, next) => {
  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`),
  )
  if (isPrivate) return requireAuth(req, res, next)
  return next()
})

apiRouter.use(profileRouter)
apiRouter.use(organizationRouter)
apiRouter.use(petsRouter)
apiRouter.use(requestsRouter)
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
