import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const accounts = {
  1: { id: 'demo', label: 'Adotante — adotante preenchido' },
  2: { id: 'demo-organization', label: 'Instituto — instituição preenchida' },
  3: { id: 'demo-empty', label: 'Perfil vazio' },
}

const terminal = createInterface({ input, output })
output.write('\nEscolha o perfil de teste:\n')
output.write('  1. Adotante — adotante preenchido\n')
output.write('  2. Instituto — instituição preenchida\n')
output.write('  3. Perfil vazio\n\n')
const answer = (await terminal.question('Digite 1, 2 ou 3: ')).trim()
terminal.close()

const account = accounts[answer]
if (!account) {
  console.error('\nOpção inválida. Execute npm run dev:mock novamente e escolha 1, 2 ou 3.')
  process.exit(1)
}

console.log(`\nIniciando como ${account.label}...\n`)

const npmCli = process.env.npm_execpath
if (!npmCli) {
  console.error('Não foi possível localizar o npm CLI. Execute este script com "npm run dev:mock".')
  process.exit(1)
}

const environment = {
  ...process.env,
  DEMO_USER_ID: account.id,
  VITE_DEMO_USER_ID: account.id,
  VITE_DEMO_SESSION_ID: String(Date.now()),
}
const children = [
  spawn(process.execPath, [npmCli, 'run', 'dev'], { env: environment, stdio: 'inherit' }),
  spawn(process.execPath, [npmCli, 'run', 'mock'], { env: environment, stdio: 'inherit' }),
]

let stopping = false
const stop = (signal = 'SIGTERM') => {
  if (stopping) return
  stopping = true
  for (const child of children) if (!child.killed) child.kill(signal)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

const exitCodes = await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on('error', (error) => {
          console.error(`Não foi possível iniciar um processo filho: ${error.message}`)
          stop()
          resolve(1)
        })
        child.on('close', (code) => {
          stop()
          resolve(code ?? 0)
        })
      }),
  ),
)
process.exit(exitCodes.find((code) => code !== 0) ?? 0)
