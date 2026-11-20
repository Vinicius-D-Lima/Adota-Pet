import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `?? ''` em vez de env(): sem DATABASE_URL o `prisma generate` continua
    // funcionando (ex.: CI, que só gera os tipos). Comandos que conectam no
    // banco (`migrate`, `db seed`, `studio`) falham com "Connection url is empty".
    url: process.env.DATABASE_URL ?? '',
  },
})
