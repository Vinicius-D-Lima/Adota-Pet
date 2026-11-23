# @adotapet/api

API real do AdotaPet (Express 5 + TypeScript + PostgreSQL/Prisma), no workspace `apps/api`. O banco fica na nuvem (Neon); **não há Docker no projeto**. O pacote `@adotapet/shared` é a fonte única dos schemas Zod usados também por `apps/web`.

## Executar

A partir da raiz do monorepo:

```bash
cp apps/api/.env.example apps/api/.env   # ajuste DATABASE_URL
npm run db:generate
npm run db:migrate                       # uma vez, para criar o schema
npm run backend
```

Sem `DATABASE_URL`, o processo encerra antes de abrir a porta e a mensagem cita a variável (INF-01). A API sobe em `http://localhost:3002`:

- `GET /health` — 200 com `{ "status": "ok", "database": "ok" }`, ou 503 se o banco estiver fora (INF-09);
- `/docs` — Swagger UI, com o JSON em `/docs/openapi.json` (INF-10);
- `/api/...` — rotas de domínio, com erros no formato `{ statusCode, error, message, details? }`.

## Autenticação (#48)

Endpoints (também disponíveis sem o prefixo `/api`, por exemplo `/auth/login`):

| Método | Rota                 | Descrição                                                           |
| ------ | -------------------- | ------------------------------------------------------------------- |
| `POST` | `/api/auth/register` | Cria a conta com senha argon2id; e-mail é normalizado em minúsculas |
| `POST` | `/api/auth/login`    | Devolve access token JWT (~15 min) e cookie de refresh (~7 dias)    |
| `POST` | `/api/auth/refresh`  | Rotaciona o refresh token; reuso revoga toda a cadeia               |
| `POST` | `/api/auth/logout`   | Revoga o refresh e limpa o cookie                                   |
| `GET`  | `/api/auth/me`       | Dados do usuário autenticado (`GET /me` é alias)                    |

O access token vai em `Authorization: Bearer <token>`. O refresh fica em cookie `httpOnly + Secure + SameSite=Lax`, guardado no banco apenas como hash SHA-256. `requireAuth` (`src/auth.ts`) preenche `req.auth` e `req.user` para os próximos módulos; os routers legados ainda aceitam `X-Demo-User-Id` enquanto o frontend #4 não é migrado.

`npm run db:seed` cria três contas com a senha `Senha@123`: `demo@adotapet.local` (adotante), `contato@institutopatinhas.org` (ONG) e `moderador@adotapet.local` (`platformRole=MODERADOR`).

## Configuração

Todas as variáveis são validadas por Zod na inicialização (`src/config.ts`). `.env.example` está versionado; `.env` não.

| Variável                         | Padrão                  | Uso                                                                     |
| -------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                   | —                       | **Obrigatória**. String de conexão do Postgres na nuvem                 |
| `TEST_DATABASE_URL`              | derivada da anterior    | Banco de teste dedicado (sufixo `_test`), nunca o banco principal       |
| `PORT`                           | `3002`                  | Porta do Express                                                        |
| `NODE_ENV`                       | `development`           | `development`, `test` ou `production` (HSTS só em produção)             |
| `CORS_ORIGIN`                    | `http://localhost:5173` | Origens permitidas, separadas por vírgula; origem desconhecida é negada |
| `RATE_LIMIT_MAX`                 | `100`                   | Máximo de requisições por janela                                        |
| `RATE_LIMIT_WINDOW_MS`           | `60000`                 | Janela do rate limit em milissegundos                                   |
| `BODY_LIMIT`                     | `100kb`                 | Limite do corpo JSON                                                    |
| `LOG_LEVEL`                      | `info`                  | Nível dos logs pino estruturados                                        |
| `DEMO_USER_ID`                   | `demo`                  | Identidade legada de demonstração (não autentica rotas JWT)             |
| `JWT_SECRET`                     | —                       | **Obrigatório**. Chave HMAC de ao menos 32 caracteres para assinar JWTs |
| `JWT_ACCESS_TTL`                 | `15m`                   | Validade do access token                                                |
| `JWT_REFRESH_TTL_DAYS`           | `7`                     | Validade do refresh token em dias                                       |
| `LOGIN_RATE_LIMIT_MAX`           | `5`                     | Tentativas de login por IP + e-mail antes do 429                        |
| `COOKIE_SECURE`                  | `true`                  | Flag `Secure` do cookie; desative só em desenvolvimento http            |
| `COOKIE_SAME_SITE`               | `lax`                   | Política `SameSite` do cookie                                           |
| `JOBS_ENABLED`                   | `true`                  | Registra workers e agendamentos pg-boss no boot                         |
| `PG_BOSS_SCHEMA`                 | `pgboss`                | Schema criado pela migration `20261122120000_jobs`                      |
| `JOBS_SHUTDOWN_TIMEOUT_MS`       | `30000`                 | Tempo limite para jobs em andamento no shutdown gracioso                |
| `STORAGE_ENDPOINT`               | —                       | Endpoint S3 compatível; vazio usa o endpoint padrão da AWS              |
| `STORAGE_REGION`                 | `us-east-1`             | Região do provedor S3                                                   |
| `STORAGE_BUCKET`                 | `adotapet`              | Bucket privado (nunca público)                                          |
| `STORAGE_ACCESS_KEY_ID`          | —                       | Chave de acesso; obrigatória com `STORAGE_ENDPOINT`                     |
| `STORAGE_SECRET_ACCESS_KEY`      | —                       | Chave secreta; obrigatória com `STORAGE_ENDPOINT`                       |
| `STORAGE_FORCE_PATH_STYLE`       | `true`                  | `true` para SeaweedFS/R2, `false` para S3 virtual-host                  |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | `60`                    | Validade da URL assinada de leitura                                     |
| `STORAGE_URL_SECRET`             | `JWT_SECRET`            | Segredo HMAC das URLs assinadas                                         |

Sem `STORAGE_ENDPOINT` e sem credenciais, as rotas de storage respondem 503 e o restante da API segue funcionando. Nenhum segredo é versionado.

## Estrutura (#47)

| Arquivo                   | Responsabilidade                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `src/config.ts`           | Validação fail-fast das variáveis de ambiente                                      |
| `src/app.ts`              | Helmet, CORS, corpo JSON, logs, rate limit, rotas e tratamento global de erros     |
| `src/validate.ts`         | Validação de `body`, `query` e `params` com schemas de `@adotapet/shared`          |
| `src/http.ts`             | Formato padrão de erro, `HttpError` e middleware global (500 genérico, sem stack)  |
| `src/logger.ts`           | Pino com `requestId` e redação de `password`, `token`, `cookie`, `CPF` etc.        |
| `src/openapi.ts`          | OpenAPI 3.1 derivada dos schemas Zod e das rotas reais do Express                  |
| `src/auth.ts`             | Argon2id, JWT HS256, hash do refresh, `requireAuth` e rotação de tokens            |
| `src/routes/`             | Routers por domínio; `auth.ts` expõe registro/login/refresh/logout/me              |
| `src/server.ts`           | Inicialização, validação da config e encerramento graceful                         |
| `src/jobs.ts`             | pg-boss: filas nomeadas, retentativa, dead letter, idempotência, cron e shutdown   |
| `src/jobs-status.ts`      | CLI `jobs:status`: inspeciona filas, agendamentos e falhas                         |
| `src/redrive.ts`          | CLI `jobs:redrive`: devolve jobs falhados da dead letter às filas de origem        |
| `src/storage.ts`          | StorageProvider/S3, validação por assinatura, chaves UUID, URLs assinadas, limpeza |
| `src/routes/storage.ts`   | Upload, emissão de URL, exclusão e entrega com `nosniff`                           |
| `src/routes/favorites.ts` | Favoritos: PUT/DELETE idempotentes, lista paginada com resumo e `/ids`             |
| `test/storage-server.ts`  | S3 compatível em processo (s3rver) usado pelos testes STO, sem Docker              |

## Testes

```bash
npm run test -w @adotapet/api        # da raiz
# ou
npm test                              # todos os workspaces
```

Os 12 testes `INF-01` a `INF-12` vivem em `src/infra.test.ts` e os 16 testes `AUTH-01` a `AUTH-16`, em `src/auth.test.ts`. Antes da suíte, `test/global-setup.ts` cria (se precisar) um database separado no mesmo Neon, aplica as migrations e grava o marcador local; `test/reset.ts` limpa as tabelas entre os testes (inclusive `RefreshToken`). Sem URL de banco configurada, `INF-11`/`INF-12` e os 16 testes `AUTH-*` são ignorados com aviso; os outros 13 rodam. Detalhes em [`docs/testes/infra-api.md`](../../docs/testes/infra-api.md) e [`docs/testes/auth.md`](../../docs/testes/auth.md).

Os nove testes `[STO-01]` a `[STO-09]` vivem em `src/storage.test.ts` e usam `test/storage-server.ts` (S3 em processo) — não precisam de Docker nem de SeaweedFS instalado. Catálogo em [`docs/testes/armazenamento.md`](../../docs/testes/armazenamento.md). Antes de implementar fotos de pets, check-ins, denúncias ou prontuário, leia [`docs/storage-integracao.md`](../../docs/storage-integracao.md): esses módulos ainda não consomem o storage.

Os sete testes `[FAV-01]` a `[FAV-07]` vivem em `src/favorites.test.ts` e usam o mesmo Postgres de teste. A rota `GET /me/favorites` devolve `{ data, total }` paginado (`page`/`limit`, padrão 1/12) com resumo do pet e `status`; `/me/favorites/ids` devolve todos os ids do usuário para os cards. Catálogo em [`docs/testes/favoritos.md`](../../docs/testes/favoritos.md).

## Outros scripts

```bash
npm run dev -w @adotapet/api
npm run typecheck -w @adotapet/api
npm run lint -w @adotapet/api
npm run build -w @adotapet/api
npm run db:seed -w @adotapet/api
```

Pela raiz: `npm run backend`, `npm run typecheck:backend`, `npm run test:backend` e `npm run build:backend`.
