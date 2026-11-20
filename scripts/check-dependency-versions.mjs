import { readFileSync } from 'node:fs'
import path from 'node:path'

const lock = JSON.parse(readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf8'))
const critical = ['zod', '@casl/ability']
const found = new Map(critical.map((name) => [name, new Set()]))

for (const [location, entry] of Object.entries(lock.packages ?? {})) {
  for (const name of critical) {
    if (location === `node_modules/${name}` || location.endsWith(`/node_modules/${name}`)) {
      if (entry.version) found.get(name).add(entry.version)
    }
  }
}

for (const name of critical) {
  const versions = [...found.get(name)]
  if (versions.length !== 1) {
    throw new Error(
      `MONO-06: ${name} deve ter uma única versão; encontradas: ${versions.join(', ')}`,
    )
  }
  console.log(`MONO-06: ${name}@${versions[0]} (única versão).`)
}
