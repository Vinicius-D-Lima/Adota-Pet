import 'dotenv/config'
import { existsSync } from 'node:fs'
import { READY_FILE, testDatabaseUrl } from './database.js'

// Configuração mínima para os testes que não tocam no banco (INF-01 a INF-10).
process.env.DATABASE_URL ??= 'postgresql://teste:teste@localhost:5432/adotapet'
process.env.NODE_ENV = 'test'
process.env.CORS_ORIGIN ??= 'http://localhost:5173'
// INF-08 cria o próprio logger em nível debug; o global fica silencioso na suíte.
process.env.LOG_LEVEL ??= 'silent'

// Quando o globalSetup preparou o database na nuvem, apontamos a aplicação para ele.
const url = existsSync(READY_FILE) ? testDatabaseUrl() : undefined
if (url) {
  process.env.DATABASE_URL = url
  process.env.API_TEST_DB_READY = '1'
} else {
  delete process.env.API_TEST_DB_READY
}
