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

## Configuração

Todas as variáveis são validadas por Zod na inicialização (`src/config.ts`). `.env.example` está versionado; `.env` não.

| Variável               | Padrão                  | Uso                                                                     |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`         | —                       | **Obrigatória**. String de conexão do Postgres na nuvem                 |
| `TEST_DATABASE_URL`    | derivada da anterior    | Banco de teste dedicado (sufixo `_test`), nunca o banco principal       |
| `PORT`                 | `3002`                  | Porta do Express                                                        |
| `NODE_ENV`             | `development`           | `development`, `test` ou `production` (HSTS só em produção)             |
| `CORS_ORIGIN`          | `http://localhost:5173` | Origens permitidas, separadas por vírgula; origem desconhecida é negada |
| `RATE_LIMIT_MAX`       | `100`                   | Máximo de requisições por janela                                        |
| `RATE_LIMIT_WINDOW_MS` | `60000`                 | Janela do rate limit em milissegundos                                   |
| `BODY_LIMIT`           | `100kb`                 | Limite do corpo JSON                                                    |
| `LOG_LEVEL`            | `info`                  | Nível dos logs pino estruturados                                        |
| `DEMO_USER_ID`         | `demo`                  | Identidade de demonstração (ainda não há JWT)                           |

## Estrutura (#47)

| Arquivo           | Responsabilidade                                                                  |
| ----------------- | --------------------------------------------------------------------------------- |
| `src/config.ts`   | Validação fail-fast das variáveis de ambiente                                     |
| `src/app.ts`      | Helmet, CORS, corpo JSON, logs, rate limit, rotas e tratamento global de erros    |
| `src/validate.ts` | Validação de `body`, `query` e `params` com schemas de `@adotapet/shared`         |
| `src/http.ts`     | Formato padrão de erro, `HttpError` e middleware global (500 genérico, sem stack) |
| `src/logger.ts`   | Pino com `requestId` e redação de `password`, `token`, `cookie`, `CPF` etc.       |
| `src/openapi.ts`  | OpenAPI 3.1 derivada dos schemas Zod e das rotas reais do Express                 |
| `src/routes/`     | Routers por domínio; `health.ts` consulta o banco                                 |
| `src/server.ts`   | Inicialização, validação da config e encerramento graceful                        |

## Testes

```bash
npm run test -w @adotapet/api        # da raiz
# ou
npm test                              # todos os workspaces
```

Os 12 testes `INF-01` a `INF-12` vivem em `src/infra.test.ts`. Antes da suíte, `test/global-setup.ts` cria (se precisar) um database separado no mesmo Postgres da nuvem, aplica as migrations e grava o marcador local; `test/reset.ts` limpa as tabelas entre os testes. Sem URL de banco configurada, apenas `INF-11`/`INF-12` são ignorados. Detalhes em [`docs/testes/infra-api.md`](../../docs/testes/infra-api.md).

## Outros scripts

```bash
npm run dev -w @adotapet/api
npm run typecheck -w @adotapet/api
npm run lint -w @adotapet/api
npm run build -w @adotapet/api
npm run db:seed -w @adotapet/api
```

Pela raiz: `npm run backend`, `npm run typecheck:backend`, `npm run test:backend` e `npm run build:backend`.
