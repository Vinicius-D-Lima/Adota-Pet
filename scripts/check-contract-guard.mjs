import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const guardPath = path.join(process.cwd(), 'packages/shared/src/contract.guard.ts')
const guard = readFileSync(guardPath, 'utf8')
if (!guard.includes('MONO-04') || !guard.includes('@ts-expect-error')) {
  throw new Error('MONO-04: falta a guarda de contrato com @ts-expect-error em packages/shared')
}

execFileSync('npm', ['run', 'typecheck', '-w', '@adotapet/shared'], {
  cwd: process.cwd(),
  stdio: 'inherit',
})
console.log('MONO-04: contrato compartilhado quebra consumidor desatualizado no typecheck.')
