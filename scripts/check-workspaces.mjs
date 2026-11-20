import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const expectedWorkspaces = [
  { dir: 'apps/web', name: '@adotapet/web' },
  { dir: 'apps/api', name: '@adotapet/api' },
  { dir: 'packages/shared', name: '@adotapet/shared' },
]

const rootPackage = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const configured = JSON.stringify(rootPackage.workspaces ?? [])
if (!configured.includes('apps/*') || !configured.includes('packages/*')) {
  throw new Error('MONO-01: a raiz precisa declarar workspaces apps/* e packages/*')
}

for (const { dir, name } of expectedWorkspaces) {
  const packagePath = path.join(root, dir, 'package.json')
  if (!existsSync(packagePath)) throw new Error(`MONO-01: falta ${dir}/package.json`)
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
  if (pkg.name !== name) throw new Error(`MONO-01: ${dir} deve se chamar ${name}`)
}

const npmLs = execFileSync('npm', ['ls', '--workspaces', '--depth=0'], {
  cwd: root,
  encoding: 'utf8',
})
for (const { name } of expectedWorkspaces) {
  if (!npmLs.includes(name)) throw new Error(`MONO-01: npm não instalou ${name}`)
}

console.log('MONO-01: os três workspaces estão declarados e instalados.')
