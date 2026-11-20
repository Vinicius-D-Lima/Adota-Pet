import { Router } from 'express'
import { sendError } from '../http.js'
import { favoritesRouter } from './favorites.js'
import { notificationsRouter } from './notifications.js'
import { organizationRouter } from './organization.js'
import { petsRouter } from './pets.js'
import { profileRouter } from './profile.js'
import { requestsRouter } from './requests.js'
import { savedFiltersRouter } from './savedFilters.js'

/** API do Adota-Pet: mesmo contrato do mock-server, persistida no PostgreSQL. */
export const apiRouter = Router()

apiRouter.use(profileRouter)
apiRouter.use(organizationRouter)
apiRouter.use(petsRouter)
apiRouter.use(requestsRouter)
apiRouter.use(favoritesRouter)
apiRouter.use(savedFiltersRouter)
apiRouter.use(notificationsRouter)

// Rotas desconhecidas respondem no formato do contrato (#47).
// Erros (Zod, parser, exceções) são tratados pelo middleware global em app.ts.
apiRouter.use((req, res) => {
  const resource = req.path.split('/')[1]
  sendError(res, 404, resource === 'pets' ? 'Pet não encontrado' : 'Recurso não encontrado')
})
