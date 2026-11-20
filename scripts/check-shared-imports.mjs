import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const consumers = [
  { file: 'apps/web/src/types.ts', label: 'apps/web' },
  { file: 'apps/api/src/validation.ts', label: 'apps/api' },
]

for (const { file, label } of consumers) {
  const source = readFileSync(path.join(root, file), 'utf8')
  if (!source.includes("'@adotapet/shared'")) {
    throw new Error(`MONO-03: ${label} não importa @adotapet/shared em ${file}`)
  }
}

console.log('MONO-03: @adotapet/shared é importado por apps/web e apps/api.')
