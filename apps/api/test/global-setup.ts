import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { READY_FILE, testDatabaseUrl } from './database.js'

const readyFile = fileURLToPath(READY_FILE)

/** Remove marcador de execuções anteriores: ninguém deve herdar banco "pronto". */
if (existsSync(readyFile)) rmSync(readyFile)

/**
 * Cria (se precisar) um database separado para os testes e aplica as migrations.
 * Roda uma vez, antes da suíte, contra o Postgres da nuvem — sem Docker.
 */
export default async function setup() {
  const adminUrl = process.env.DATABASE_URL?.trim()
  const testUrl = testDatabaseUrl()
  if (!adminUrl || !testUrl || adminUrl === testUrl) {
    console.warn('[INF-12] Sem DATABASE_URL/TEST_DATABASE_URL: testes de banco serão ignorados.')
    return
  }

  const name = new URL(testUrl).pathname.slice(1)
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) })
  try {
    const existing = await admin.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${name}) AS exists
    `
    if (!existing[0]?.exists) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`)
      console.log(`[INF-12] database de teste criado: ${name}`)
    }
  } catch (error) {
    console.warn(
      `[INF-12] Não foi possível preparar ${name}: ${error instanceof Error ? error.message : error}`,
    )
    return
  } finally {
    await admin.$disconnect()
  }

  const prismaCli = (args: string[]) =>
    execFileSync('npx', ['prisma', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    })

  try {
    prismaCli(['migrate', 'deploy'])
    console.log(`[INF-12] migrations aplicadas em ${name}`)
  } catch {
    try {
      prismaCli(['db', 'push', '--skip-generate'])
      console.log(`[INF-12] schema sincronizado em ${name} (db push)`)
    } catch (error) {
      console.warn(`[INF-12] Falha ao aplicar o schema em ${name}:`, error)
      return
    }
  }

  // Marcador não guarda credenciais: a URL é derivada do ambiente em setup.ts.
  writeFileSync(readyFile, JSON.stringify({ name }))
}
