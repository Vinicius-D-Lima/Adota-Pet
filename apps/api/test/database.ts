import 'dotenv/config'

/** Marcador escrito pelo globalSetup quando o database de teste está pronto. */
export const READY_FILE = new URL('./.test-db-ready', import.meta.url)

/** URL do banco de teste dedicado (sempre diferente do banco principal). */
export function testDatabaseUrl(): string | undefined {
  const explicit = process.env.TEST_DATABASE_URL?.trim()
  if (explicit) return explicit

  const source = process.env.DATABASE_URL?.trim()
  if (!source) return undefined

  try {
    const url = new URL(source)
    if (url.pathname.endsWith('_test')) return source
    const name = url.pathname.replace(/^\//, '') || 'adotapet'
    url.pathname = `/${name}_test`
    return url.toString()
  } catch {
    return undefined
  }
}

/** Só vale se o globalSetup conseguiu criar/migrar o banco nesta execução. */
export const hasTestDatabase = () => process.env.API_TEST_DB_READY === '1'
