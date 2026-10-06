import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const accounts = {
  '1': { id: 'demo', label: 'Adotante — adotante preenchido' },
  '2': { id: 'demo-organization', label: 'Instituto — instituição preenchida' },
  '3': { id: 'demo-empty', label: 'Perfil vazio' },
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

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const environment = {
  ...process.env,
  DEMO_USER_ID: account.id,
  VITE_DEMO_USER_ID: account.id,
  VITE_DEMO_SESSION_ID: String(Date.now()),
}
const children = [
  spawn(npm, ['run', 'dev'], { env: environment, stdio: 'inherit' }),
  spawn(npm, ['run', 'mock'], { env: environment, stdio: 'inherit' }),
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
        child.on('exit', (code) => {
          stop()
          resolve(code ?? 0)
        })
      }),
  ),
)
process.exit(exitCodes.find((code) => code !== 0) ?? 0)
