import cors from 'cors'
import express from 'express'
import { healthRouter } from './routes/health.js'

/**
 * Origens liberadas pelo CORS.
 * Sem `CORS_ORIGIN`, a origem do pedido é refletida (bom para desenvolvimento).
 * Em produção, defina `CORS_ORIGIN=https://seu-dominio` (separadas por vírgula).
 */
function corsOrigin(): true | string[] {
  const configured = process.env.CORS_ORIGIN?.trim()
  if (!configured) return true
  return configured.split(',').map((origin) => origin.trim())
}

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(cors({ origin: corsOrigin() }))
  app.use(healthRouter)

  return app
}
