import 'dotenv/config'
import { z } from 'zod'

/**
 * Configuração da API (#47 / INF-01).
 *
 * `loadConfig` é a única porta de entrada para variáveis de ambiente. Ela valida
 * tudo na inicialização: se faltar `DATABASE_URL`, o processo morre antes de
 * abrir a porta, com uma mensagem que diz exatamente qual variável falta.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL é obrigatória (configure apps/api/.env)' })
    .min(1, 'DATABASE_URL não pode ser vazia'),
  /** Origens do frontend, separadas por vírgula. Nada de refletir Origin desconhecida. */
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean),
    )
    .pipe(
      z.array(z.url('CORS_ORIGIN deve conter URLs válidas')).min(1, 'CORS_ORIGIN é obrigatória'),
    ),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  BODY_LIMIT: z.string().min(1).default('100kb'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DEMO_USER_ID: z.string().min(1).default('demo'),
  /** URL opcional de um database separado para os testes (sem Docker). */
  TEST_DATABASE_URL: z.string().optional(),

  // Autenticação (#48). JWT_SECRET é obrigatório pelo mesmo motivo de DATABASE_URL:
  // sem chave não há como assinar tokens com segurança.
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET é obrigatório (configure apps/api/.env)' })
    .min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** `false` só para desenvolvimento local em http; em produção mantenha `true`. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  REFRESH_COOKIE_NAME: z.string().min(1).default('refresh_token'),
})

export type ApiConfig = z.infer<typeof envSchema>

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Configuração inválida:\n- ${issues.join('\n- ')}`)
    this.name = 'ConfigError'
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((issue) => issue.message))
  }
  return parsed.data
}
