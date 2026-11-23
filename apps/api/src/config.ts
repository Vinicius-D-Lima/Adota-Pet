import 'dotenv/config'
import { z } from 'zod'

/**
 * Configuração da API (#47 / INF-01).
 *
 * `loadConfig` é a única porta de entrada para variáveis de ambiente. Ela valida
 * tudo na inicialização: se faltar `DATABASE_URL`, o processo morre antes de
 * abrir a porta, com uma mensagem que diz exatamente qual variável falta.
 */
/** Variável opcional: string vazia (comum no CI) conta como ausente. */
const optionalEnv = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
)

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
  /** #22/CHAT-08: teto específico de envio de mensagens, por cliente autenticado. */
  CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  CHAT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
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

  // Fila de jobs (#95). O schema é criado pela migration; `JOBS_ENABLED=false`
  // mantém a API respondendo sem registrar workers (útil em desenvolvimento).
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  PG_BOSS_SCHEMA: z.string().min(1).default('pgboss'),
  JOBS_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // Armazenamento de arquivos (#94). Nenhum segredo é versionado: endpoint,
  // bucket e credenciais vêm de variáveis de ambiente. Sem endpoint o módulo
  // fica desligado e as rotas respondem 503 — a API continua subindo.
  STORAGE_ENDPOINT: optionalEnv,
  STORAGE_REGION: z.string().trim().min(1).default('us-east-1'),
  STORAGE_BUCKET: z.string().trim().min(1).default('adotapet'),
  STORAGE_ACCESS_KEY_ID: optionalEnv,
  STORAGE_SECRET_ACCESS_KEY: optionalEnv,
  STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  /** Segredo das URLs assinadas da API; por padrão reusa JWT_SECRET. */
  STORAGE_URL_SECRET: optionalEnv,

  // Notificações (#30). Sem SMTP_HOST o transporte é JSON (sem envio real),
  // para que a API continue subindo em desenvolvimento e nos testes. O Mailpit
  // roda como processo local/nativo na porta 1025 — não usamos Docker.
  SMTP_HOST: optionalEnv,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: optionalEnv,
  SMTP_PASSWORD: optionalEnv,
  SMTP_FROM: z.string().trim().min(1).default('AdotaPet <nao-resposta@adotapet.local>'),
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
