import 'dotenv/config'
import { existsSync } from 'node:fs'
import { READY_FILE, testDatabaseUrl } from './database.js'

/**
 * Configuração mínima para os testes que não tocam no banco (INF-01 a INF-10).
 *
 * Importante: no GitHub Actions, um secret ausente vira **string vazia**, não
 * `undefined`. `??=` não cobre esse caso e o Zod reprova `DATABASE_URL=''`
 * (INF-01). Por isso tratamos vazio como ausente aqui.
 */
function ensureEnv(name: string, fallback: string): void {
  if (!process.env[name]?.trim()) process.env[name] = fallback
}

ensureEnv('DATABASE_URL', 'postgresql://teste:teste@localhost:5432/adotapet')
// Chave de teste determinística: nunca usar fora da suíte.
ensureEnv('JWT_SECRET', 'chave-de-teste-autenticacao-adotapet-com-mais-de-32-caracteres')
process.env.NODE_ENV = 'test'
ensureEnv('CORS_ORIGIN', 'http://localhost:5173')
// INF-08 cria o próprio logger em nível debug; o global fica silencioso na suíte.
ensureEnv('LOG_LEVEL', 'silent')

// Quando o globalSetup preparou o database na nuvem, apontamos a aplicação para ele.
const url = existsSync(READY_FILE) ? testDatabaseUrl() : undefined
if (url) {
  process.env.DATABASE_URL = url
  process.env.API_TEST_DB_READY = '1'
} else {
  delete process.env.API_TEST_DB_READY
}
