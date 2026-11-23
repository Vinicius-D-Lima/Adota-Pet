import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Setup pós-pull do monorepo (#94/#95).
 *
 * Quem puxa o branch roda `npm run setup:pull` e recebe, na ordem correta:
 * instalação, cliente Prisma regenerado e testes.
 * O cliente gerado é ignorado pelo git, então `db:generate` não é opcional.
 * Migrations NÃO são aplicadas aqui: use `npm run db:deploy` manualmente
 * apenas quando apontar para um banco novo.
 */
const root = process.cwd()
const flags = new Set(process.argv.slice(2))

if (flags.has('--help') || flags.has('-h')) {
  console.log(`Uso: npm run setup:pull -- [opções]

  --skip-install  não roda npm ci (útil se as deps já estão instaladas)
  --skip-test     não roda a suíte completa ao final
  -h, --help      mostra esta ajuda

DATABASE_URL é necessária apenas quando os testes rodam (ambiente ou apps/api/.env).`)
  process.exit(0)
}

const skipInstall = flags.has('--skip-install')
const skipTest = flags.has('--skip-test') || flags.has('--no-test')

function temDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return true
  const envPath = path.join(root, 'apps/api/.env')
  if (!existsSync(envPath)) return false
  return /^\s*DATABASE_URL\s*=\s*\S+/m.test(readFileSync(envPath, 'utf8'))
}

function passo(label, comando, argumentos) {
  console.log(`\n▶ ${label}`)
  try {
    execFileSync(comando, argumentos, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  } catch {
    console.error(`\n✖ ${label} falhou. Corrija o erro acima e rode novamente:`)
    console.error('  npm run setup:pull')
    process.exit(1)
  }
  console.log(`✔ ${label}`)
}

console.log('Setup pós-pull — AdotaPet')

if (!skipTest && !temDatabaseUrl()) {
  console.error(`\n✖ DATABASE_URL não encontrada.`)
  console.error('  Copie apps/api/.env.example para apps/api/.env e preencha:')
  console.error('    DATABASE_URL=postgresql://...')
  console.error('    JWT_SECRET=chave-aleatoria-com-ao-menos-32-caracteres')
  console.error('  Depois rode: npm run setup:pull')
  process.exit(1)
}

if (!skipInstall) passo('Instalando dependências (npm ci)', 'npm', ['ci'])
passo('Gerando cliente Prisma (db:generate)', 'npm', ['run', 'db:generate'])
if (!skipTest) passo('Rodando testes de todos os workspaces', 'npm', ['test'])

console.log(`
✔ Setup concluído.

Próximos passos:
  npm run db:deploy # só se apontar para um banco novo (migrations)
  npm run db:seed   # só se o banco estiver vazio
  npm run dev:all   # sobe web (:5173) + API (:3002)
  npm run jobs:status  # inspeciona filas, agendamentos e falhas

Documentação: README.md e docs/storage-integracao.md`)
