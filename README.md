# AdotaPet

Monorepo **npm workspaces** com três pacotes:

- [`apps/web`](apps/web): frontend React + TypeScript + Vite (Tailwind CSS, react-hook-form e TanStack Query).
- [`apps/api`](apps/api): API real em Express + TypeScript + PostgreSQL/Prisma.
- [`packages/shared`](packages/shared): schemas Zod e tipos que formam o **contrato único** entre web e api.

A API simulada em json-server continua disponível dentro de `apps/web/mock-server` para desenvolvimento e demonstração sem banco. Ela segue o mesmo contrato do pacote compartilhado.

## Decisão de arquitetura

A raiz declara:

```json
"workspaces": ["apps/*", "packages/*"]
```

Não há Turborepo, pnpm ou outra ferramenta de orquestração por enquanto: os scripts da raiz apenas delegam para os workspaces. O pacote `@adotapet/shared` é a fonte única dos schemas; `apps/web` e `apps/api` importam dele, e o CI quebra se um dos dois ficar desatualizado.

Histórico e detalhes: [decisão #26](docs/decisoes.md#26-monorepo-com-npm-workspaces) e [testes MONO](docs/testes/monorepo.md).

## Estrutura

```
.
├── apps/
│   ├── web/                    # @adotapet/web — frontend e mock-server
│   │   ├── mock-server/        # API simulada (json-server), seed e testes de contrato
│   │   ├── scripts/            # dev:mock
│   │   ├── src/                # componentes, páginas, hooks, lib e utils
│   │   ├── index.html
│   │   └── vite.config.ts      # proxy /api → api (3002) ou mock (3001 no dev:mock)
│   └── api/                    # @adotapet/api — Express + Prisma
│       ├── prisma/             # schema, migrations e seed
│       └── src/                # app, rotas, contexto e testes
├── packages/
│   └── shared/                 # @adotapet/shared — schemas Zod e tipos
│       └── src/
├── scripts/                    # verificações MONO-01, MONO-03, MONO-04 e MONO-06
├── docs/
└── package.json                # workspaces apps/* e packages/*
```

## Documentação

A documentação completa está em [`docs/`](docs/README.md):

- [Visão geral](docs/visao-geral.md), [Funcionalidades](docs/funcionalidades.md) e [Arquitetura](docs/arquitetura.md)
- [API simulada](docs/api-simulada.md): contrato, validações, erros e uso em testes
- [Qualidade, testes e CI](docs/qualidade-e-ci.md) e [Testes do monorepo](docs/testes/monorepo.md)
- [Decisões técnicas](docs/decisoes.md), [Histórico](docs/historico.md) e [Roadmap](docs/roadmap.md)
- Manuais: [instalação](docs/manual-de-instalacao.md), [operação](docs/manual-de-operacao.md) e [usuário](docs/manual-do-usuario.md)

## Pré-requisitos

- Node.js 22+ e npm
- PostgreSQL apenas para executar a API real

## Instalação

```bash
npm ci
```

O comando instala os três workspaces a partir do `package-lock.json` da raiz. Para atualizar o lock, use `npm install`.

### Setup pós-pull (recomendado para quem acabou de clonar/puxar)

Depois de configurar `apps/api/.env`, um único comando instala as deps, gera o cliente Prisma (que **não é versionado**) e roda a suíte completa:

```bash
npm run setup:pull
```

Opções: `npm run setup:pull -- --skip-install` (deps já instaladas) e `npm run setup:pull -- --skip-test` (só preparar o ambiente). `DATABASE_URL` só é exigida quando os testes rodam.

> O script **não aplica migrations**. No Neon compartilhado elas já estão aplicadas; se você apontar a API para um banco novo, rode `npm run db:deploy` manualmente. Para conferir o estado das migrations sem alterar nada: `npm exec -w @adotapet/api -- prisma migrate status`.

## Como executar

### 1) Frontend + API real

A API expõe as rotas sob `/api`. O Vite faz proxy de `/api` para `http://localhost:3002`.

1. Configure a API:
   - Copie `apps/api/.env.example` para `apps/api/.env`
   - Ajuste `DATABASE_URL` (e `PORT`/`CORS_ORIGIN` se necessário)
   - Prepare o banco: `npm run db:generate`, `npm run db:migrate` e, se aplicável, `npm run db:seed`
2. Suba os dois processos:

```bash
npm run dev:all
```

- Frontend: http://localhost:5173
- API: http://localhost:3002 (`GET /health`, Swagger em `/docs`)

Atalhos: `npm run dev` (só web), `npm run backend` (só api).

> A autenticação JWT está integrada ao frontend: `/entrar` e `/cadastro` chamam `/auth/login` e `/auth/register`, o access token fica somente em memória e o refresh é um cookie `httpOnly`. Configure `JWT_SECRET` no `apps/api/.env` antes de subir a API.

### Rotas públicas × protegidas

A proteção de navegação usa guardas do `react-router-dom` — `ProtectedRoute`, `GuestRoute`, `AccountTypeRoute` e `OrganizacaoGuard` (em `apps/web/src/App.tsx`). Não existe `middleware.ts` do Next.js porque a migração para Next foi encerrada.

**Públicas** (acesso sem login):

- `/` — home
- `/pets` e `/pets/:petId` — listagem e detalhe do pet
- `/entrar`, `/cadastro` e `/criar-conta` — somente para visitantes; usuário autenticado é redirecionado para `/`
- `*` — página 404

**Protegidas** (sem sessão redirecionam para `/entrar`; após o login, voltam à rota original):

- `/perfil`
- `/solicitacoes` e `/solicitacoes/:requestId/enviada`
- `/pets/:petId/questionario` e `/pets/:petId/compatibilidade`
- `/favoritos` e `/minhas-buscas`
- `/notificacoes` e `/notificacoes/preferencias`
- `/denuncias/nova`
- `/organizacao` e subrotas — além da sessão, exigem perfil de instituição (`GUARDIAN`)

As rotas de adotante usam `AccountTypeRoute`, que também impede uma conta de instituição de acessá-las. Enquanto a restauração da sessão está em voo, aparece “Verificando sua sessão...” para evitar o “piscar” deslogado.

Os guardas do frontend controlam apenas a **navegação** — não são segurança. A validação real do JWT acontece no backend, a cada requisição aos prefixos privados `/api/me/*` e `/api/requests/*` (`requireAuth` com verificação de assinatura, `iss`, `aud` e expiração), com refresh único e retry em 401. Uma chamada direta à API sem token válido recebe 401 mesmo que a interface mostre a página.

Contas de demonstração no banco principal (senha `Senha@123`): `demo@adotapet.local`, `contato@institutopatinhas.org`, `demo-empty@adotapet.local` e `moderador@adotapet.local`.

### Matriz de permissões (CASL)

Fonte: [issue #28](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/28). As regras ficam em `apps/api/src/ability.ts`; o teste `RBAC-09` lê esta tabela e compara com elas. `–` significa que a ação não se aplica ao papel.

| Ação                                                    | ADMIN | VOLUNTÁRIO | ADOTANTE | MODERADOR (plataforma) |
| ------------------------------------------------------- | :---: | :--------: | :------: | :--------------------: |
| Gerenciar membros e convites                            |  ✅   |     ❌     |    ❌    |           ❌           |
| Editar dados da organização                             |  ✅   |     ❌     |    ❌    |           ❌           |
| Cadastrar e editar pets da organização                  |  ✅   |     ✅     |    ❌    |           ❌           |
| Editar prontuário médico                                |  ✅   |     ✅     |    ❌    |           ❌           |
| Conduzir etapas, agendar e conversar no chat            |  ✅   |     ✅     |    ❌    |           ❌           |
| **Aprovar adoção (decisão final)**                      |  ✅   |     ❌     |    ❌    |           ❌           |
| Recusar solicitação                                     |  ✅   |     ✅     |    ❌    |           ❌           |
| Criar solicitação, cancelar a própria e enviar check-in |   –   |     –      |    ✅    |           –            |
| Moderar denúncias                                       |  ❌   |     ❌     |    ❌    |           ✅           |

Todas as permissões de organização valem **apenas dentro da organização** da qual o usuário é membro. Papéis da plataforma (`ADOTANTE`/`MODERADOR`) não herdam poder sobre organizações; `MODERADOR` apenas modera denúncias.

### 2) Frontend + mock-server (sem banco)

```bash
npm run dev:mock
```

O script pergunta o perfil de demonstração (adotante, instituição admin, instituição voluntária ou perfil vazio), sobe o Vite e o mock-server e define `VITE_API_PROXY_TARGET=http://localhost:3001`. Assim, o proxy `/api` aponta para o mock sem editar `vite.config.ts` nem criar `.env`.

Para usar apenas uma parte:

```bash
npm run mock        # só o mock em http://localhost:3001
npm run dev         # só o frontend (proxy padrão: API real em 3002)
npm run mock:reset  # restaura apps/web/mock-server/db.json a partir do seed
```

Configurações do mock: `MOCK_PORT` (padrão `3001`) e `MOCK_DELAY_MS` (padrão `300`).

### Variáveis de ambiente

| Arquivo                 | Variável                                                 | Padrão                    | Uso                                                     |
| ----------------------- | -------------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| `apps/web/.env.example` | `VITE_API_URL`                                           | `/api`                    | Base da API consumida pelo frontend                     |
| `apps/web/.env.example` | `VITE_API_PROXY_TARGET`                                  | `:3002`                   | Destino do proxy do Vite; `dev:mock` ajusta para o mock |
| `apps/api/.env.example` | `DATABASE_URL`                                           | —                         | Conexão PostgreSQL do Prisma (**obrigatória**)          |
| `apps/api/.env.example` | `TEST_DATABASE_URL`                                      | sufixo `_test`            | Banco de teste dedicado, nunca o banco principal        |
| `apps/api/.env.example` | `PORT`                                                   | `3002`                    | Porta da API                                            |
| `apps/api/.env.example` | `CORS_ORIGIN`                                            | `http://localhost:5173`   | Origens liberadas pelo CORS, separadas por vírgula      |
| `apps/api/.env.example` | `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` / `BODY_LIMIT` | `100` / `60000` / `100kb` | Limites globais da API                                  |
| `apps/api/.env.example` | `LOG_LEVEL`                                              | `info`                    | Nível dos logs estruturados                             |
| `apps/api/.env.example` | `JOBS_ENABLED`                                           | `true`                    | Registra workers e agendamentos no boot da API          |
| `apps/api/.env.example` | `PG_BOSS_SCHEMA`                                         | `pgboss`                  | Schema do pg-boss (criado pela migration)               |
| `apps/api/.env.example` | `JOBS_SHUTDOWN_TIMEOUT_MS`                               | `30000`                   | Tempo limite do shutdown gracioso dos jobs              |
| `apps/api/.env.example` | `STORAGE_ENDPOINT`                                       | —                         | Endpoint S3 (SeaweedFS/R2/S3); vazio usa o endpoint AWS |
| `apps/api/.env.example` | `STORAGE_REGION`                                         | `us-east-1`               | Região do provedor S3                                   |
| `apps/api/.env.example` | `STORAGE_BUCKET`                                         | `adotapet`                | Bucket privado; nunca público                           |
| `apps/api/.env.example` | `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY`    | —                         | Credenciais; obrigatórias quando há `STORAGE_ENDPOINT`  |
| `apps/api/.env.example` | `STORAGE_FORCE_PATH_STYLE`                               | `true`                    | `true` para SeaweedFS/R2; `false` para S3 virtual-host  |
| `apps/api/.env.example` | `STORAGE_SIGNED_URL_TTL_SECONDS`                         | `60`                      | Validade da URL assinada de leitura                     |
| `apps/api/.env.example` | `STORAGE_URL_SECRET`                                     | `JWT_SECRET`              | Segredo HMAC das URLs assinadas                         |

A API valida a configuração na inicialização e não sobe se faltar variável obrigatória. O banco fica na nuvem; **não há Docker**. `GET /health` devolve 503 quando o banco está fora. Veja [`apps/api/README.md`](apps/api/README.md).

### Fila de jobs (pg-boss)

O schema `pgboss` e o ledger `JobEffect` são criados pela migration `20261122120000_jobs` em `apps/api/prisma/migrations` — a aplicação não depende de migração automática do pg-boss. Todo o registro de filas, workers e agendamentos vive em [`apps/api/src/jobs.ts`](apps/api/src/jobs.ts), e a API inicia a fila antes de abrir a porta.

| Fila                        | Tipo de evento / finalidade                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `NewRequestForOrganization` | Nova solicitação de adoção (payload validado com Zod no consumidor) |
| `outbox-dispatch`           | Publica os eventos pendentes do `EventOutbox` na fila de domínio    |
| `check-in-overdue`          | Check-ins atrasados — todo dia às 08:00 UTC                         |
| `daily-digest`              | Resumo diário — todo dia às 07:00 UTC                               |
| `jobs-dead-letter`          | Destino dos jobs que esgotaram a retentativa                        |

Regras da fila:

- **Transação**: `enqueueJob(..., { tx })` usa `fromPrisma(tx)`; se a transação desfizer, o job não existe. Eventos de domínio entram no `EventOutbox` na mesma transação da gravação.
- **Retentativa**: 3 tentativas com backoff exponencial (delay base de 2s); depois disso o job vai para `jobs-dead-letter`.
- **Idempotência**: a publicação usa `singletonKey` por evento e o consumidor usa `runOnce()`, que grava a chave em `JobEffect` com PK — uma segunda entrega não repete o efeito.
- **Payload**: só identificadores e metadados. `strictObject` do Zod rejeita `password`, `token`, `cpf` ou qualquer campo extra no consumidor.
- **Shutdown**: `SIGTERM`/`SIGINT` chamam `boss.stop({ graceful: true, timeout })`; jobs em andamento terminam antes de o processo sair.

Para inspecionar filas, agendamentos, eventos pendentes e falhas sem escrever SQL (usa o `DATABASE_URL` da API):

```bash
npm run jobs:status
```

Para reprocessar uma falha, corrija a causa e devolva os jobs da dead letter às filas de origem:

```bash
npm run jobs:redrive
```

O catálogo com os oito cenários automatizados (`[JOB-01]` a `[JOB-08]`) está em [`docs/testes/fila-jobs.md`](docs/testes/fila-jobs.md).

### Armazenamento de arquivos (#94)

Um módulo único guarda e entrega fotos e anexos. O código fala a API S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) por trás da interface `StorageProvider` em [`apps/api/src/storage.ts`](apps/api/src/storage.ts); o provedor local recomendado é o **SeaweedFS** (Apache-2.0) com gateway S3. **Não há compose/Docker neste projeto**: suba o SeaweedFS fora dele (ou use R2/S3) e aponte as variáveis acima. Trocar de provedor é só mudar variáveis — nenhuma linha de código muda.

> **Importante:** os módulos `#24` (check-ins), `#26` (denúncias), `#29` (prontuário) e `#49` (fotos de pets) **ainda não consomem o storage**. A integração de cada um está especificada em [`docs/storage-integracao.md`](docs/storage-integracao.md) — leia-a antes de implementar qualquer um deles. Hoje apenas a exclusão de pet já remove os objetos ligados ao registro.

Rotas:

| Rota                                | Autenticação                | Uso                                                                   |
| ----------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `POST /api/storage/objects`         | Bearer JWT                  | `multipart/form-data`: `files`, `scope`, `resourceType`, `resourceId` |
| `POST /api/storage/objects/:id/url` | Bearer JWT (dono do objeto) | Emite nova URL assinada curta                                         |
| `DELETE /api/storage/objects/:id`   | Bearer JWT (dono do objeto) | Apaga objeto no provedor e metadados                                  |
| `GET /files/:id?token=...`          | URL assinada (HMAC, curta)  | Entrega o arquivo com `Content-Type` correto e `nosniff`              |

Regras do módulo:

- **Tipo pelo conteúdo:** `file-type` lê a assinatura do arquivo; extensão e `Content-Type` enviados pelo cliente são ignorados. Executável com nome `.png` é recusado.
- **Limites por escopo:** `STORAGE_SCOPES` define prefixo, MIMEs permitidos, quantidade e tamanho máximo por operação (#49: 8 fotos de 5 MB; #24/#26: 5 de 5 MB; #29: 5 de 10 MB com PDF).
- **Nome seguro:** chave = prefixo + UUID + extensão detectada. Nenhum nome do cliente entra no caminho; `../` não escapa do prefixo.
- **Bucket privado:** o cliente nunca recebe URL do bucket. A URL assinada é da própria API (HMAC curto), o que garante 403 previsível sem assinatura/expirada em qualquer provedor e permite aplicar `X-Content-Type-Options: nosniff` na entrega.
- **Sem órfãos:** `deleteStorageObjectsForResource(tipo, id)` remove os objetos quando o registro dono é apagado.
- **Sem storage configurado:** as rotas respondem 503; a API continua subindo normalmente.

### Subindo o storage (sem Docker)

Instale o binário `weed` do SeaweedFS e crie um arquivo **fora do repositório** com as credenciais (nunca commite):

```json
{
  "identities": [
    {
      "name": "adotapet-dev",
      "credentials": [{ "accessKey": "dev-access", "secretKey": "dev-secret" }],
      "actions": ["Admin", "List", "Read", "Write"]
    }
  ]
}
```

```bash
weed server -dir=/tmp/seaweedfs -s3 -s3.port=8333 -s3.config=/caminho/fora/do/repo/s3.json
```

Aponte `STORAGE_ENDPOINT=http://127.0.0.1:8333`, `STORAGE_BUCKET=adotapet` e as mesmas chaves no `apps/api/.env`; o bucket é criado na primeira upload (`ensureBucket()`). Para R2 ou S3, troque endpoint/região/bucket/credenciais e use `STORAGE_FORCE_PATH_STYLE=false` no S3. Nenhuma mudança de código.

Os nove testes `[STO-01]` a `[STO-09]` rodam com um S3 compatível em processo (`s3rver`), sem Docker, contra o Postgres de teste. Catálogo em [`docs/testes/armazenamento.md`](docs/testes/armazenamento.md).

Os sete testes `[FAV-01]` a `[FAV-07]` cobrem favoritos (idempotência, 404, isolamento entre usuários, 401, paginação e `/ids`) no mesmo banco de teste, também sem Docker. Catálogo em [`docs/testes/favoritos.md`](docs/testes/favoritos.md).

## Dados do mock e testes

- `apps/web/mock-server/db.seed.json`: seed versionado (contas demo, pets, perfis, favoritos, solicitações, notificações).
- `apps/web/mock-server/db.json`: banco em uso, criado na primeira execução e ignorado pelo git.

Se o perfil aparecer incompleto ou `POST /requests` responder 422, rode `npm run mock:reset`.

```bash
npm test                 # roda os testes de @adotapet/api, @adotapet/web e @adotapet/shared
npm run test:backend     # só a API
npm run test:watch       # modo watch do web
```

Os testes do mock (`server.test.js` e `contract.test.js`) rodam dentro do workspace web. O `contract.test.js` valida as respostas reais do mock contra os schemas de `@adotapet/shared`.

Detalhes completos: [docs/api-simulada.md](docs/api-simulada.md).

## Contrato da API (resumo)

| Rota                                                     | Descrição                                                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /pets?search&species&size&sex&city&sort&page&limit` | `{ data, total }`; `sort` = `recent` \| `name` \| `distance`. Parâmetros desconhecidos retornam **400**. `sort=distance` usa a referência do usuário demo. |
| `GET /pets/:id`                                          | Pet (404 se não existir)                                                                                                                                   |
| `GET /me`                                                | Usuário de demonstração                                                                                                                                    |
| `GET /me/adopter-profile`                                | Perfil + `isComplete` + `missingFields`                                                                                                                    |
| `PUT /me/adopter-profile`                                | Atualização parcial com validação por campo (**400** em inválido; `""` limpa campo)                                                                        |
| `POST /requests`                                         | Cria solicitação (422 se perfil incompleto; 409 se duplicada ativa)                                                                                        |
| `GET /me/requests`, `GET /requests/:id`                  | Solicitações do usuário                                                                                                                                    |
| `POST /requests/:id/transitions`                         | Transição suportada pelo adotante (ex.: cancelamento)                                                                                                      |
| `GET /me/favorites?page=&limit=`                         | Favoritos paginados: resumo do pet com `status` (`ADOTADO`/`ARQUIVADO` continuam na lista); `total` é global                                               |
| `GET /me/favorites/ids`                                  | Só os ids do usuário (sem paginação), para marcar os corações nos cards                                                                                    |
| `PUT/DELETE /me/favorites/:petId`                        | Favorita/desfavorita de forma idempotente (204); pet inexistente no PUT retorna 404                                                                        |
| Rotas `/me/organization-*`, `/me/received-requests*` etc | Área da instituição/responsável (perfis, pets, solicitações recebidas, permissões, entrevista/triagem/aprovação conforme papel)                            |

Formato de erro: `{ statusCode, error, message, details? }`, com `details: [{ field, message }]` quando aplicável.

## Scripts da raiz

| Script                                             | Descrição                                                    |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                                      | Frontend (Vite), workspace `@adotapet/web`                   |
| `npm run dev:all`                                  | Frontend + API                                               |
| `npm run dev:mock`                                 | Frontend + mock-server, com seleção de perfil demo           |
| `npm run preview`                                  | Serve o build do frontend em http://localhost:4173           |
| `npm run mock` / `npm run mock:reset`              | Mock-server / restauração do seed                            |
| `npm run backend`                                  | API (`@adotapet/api`)                                        |
| `npm run build`                                    | Build de shared, web e api, nesta ordem                      |
| `npm run build:web` / `build:api` / `build:shared` | Build de um workspace específico                             |
| `npm run typecheck`                                | Typecheck de todos os workspaces                             |
| `npm test`                                         | Testes de todos os workspaces                                |
| `npm run lint` / `lint:fix`                        | ESLint em todos os workspaces                                |
| `npm run format` / `format:check`                  | Prettier                                                     |
| `npm run setup:pull`                               | Pós-pull: `npm ci` + `db:generate` + `npm test`              |
| `npm run db:generate`                              | Gera o cliente Prisma no workspace da API                    |
| `npm run db:migrate` / `db:deploy` / `db:seed`     | Migrações e seed do banco na API                             |
| `npm run db:studio` / `db:reset` / `db:push`       | Utilitários do Prisma na API                                 |
| `npm run jobs:status`                              | Mostra filas, agendamentos e falhas da fila de jobs          |
| `npm run jobs:redrive`                             | Reprocessa jobs falhados da dead letter                      |
| `npm run check:workspaces`                         | MONO-01: workspaces declarados e instalados                  |
| `npm run check:shared-imports`                     | MONO-03: shared importado por web e api                      |
| `npm run check:deps`                               | MONO-06: versão única de `zod` e `@casl/ability` no lockfile |
| `npm run check:contract`                           | MONO-04: guarda de contrato no `typecheck` do shared         |

## CI

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em todo PR e em push na `main`. Os passos nomeiam os IDs `MONO-01` a `MONO-06`:

- `MONO-01`: `npm ci` + verificação dos três workspaces
- `MONO-02`: build do web a partir da raiz
- `MONO-03`: import do shared por web e api
- `MONO-04`: mudança no contrato quebra o typecheck
- `MONO-05`: lint, formatação, tipos, testes e builds de **todos** os workspaces
- `MONO-06`: uma única versão das bibliotecas críticas

Antes de abrir um PR, rode na mesma ordem:

```bash
npm ci
npm run check:workspaces
npm run check:shared-imports
npm run check:deps
npm run check:contract
npm run db:generate
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## Publicação / deploy

- `npm run build` gera `apps/web/dist/` e `apps/api/dist/`, além dos arquivos de declaração em `packages/shared/dist/`.
- A hospedagem estática serve `apps/web/dist/`; ela precisa de uma API acessível em `VITE_API_URL`.
- O mock-server é um processo Node separado: hospede-o à parte se quiser usá-lo em uma demo publicada.
- A API real requer Node + PostgreSQL e as variáveis de `apps/api/.env`.

## Componentes de UI

Os componentes reutilizáveis ficam em `apps/web/src/components/ui/` e os da aplicação em `apps/web/src/components/`. Tokens do Tailwind em `apps/web/src/index.css`.

| Componente                                | Uso                                                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                  | `variant`: `primary` (padrão), `secondary`, `cream`, `danger`, `text`, `text-danger`; `size`: `md`, `sm`; `fullWidth`; `loading` |
| `LinkButton`                              | Link do React Router com a aparência de `Button`                                                                                 |
| `Field` + `Input` / `Select` / `Textarea` | `Field` traz rótulo, dica e `error`; os controles aceitam `invalid`                                                              |
| `Checkbox`                                | `label`, `description` e `error`                                                                                                 |
| `Card`                                    | Superfície base; `as` troca a tag e `className` define o layout                                                                  |
| `Badge` / `StatusPill`                    | `Badge tone="review/approved/sent/declined"`; `StatusPill` mapeia o status da solicitação                                        |
| `Alert`                                   | Erro de formulário/ação com `role="alert"`                                                                                       |
| `EmptyState`                              | Estado vazio ou de erro: `icon`, `title`, `description`, filhos (ação)                                                           |
| `Spinner`, `PageIntro`                    | Indicador de carregamento e cabeçalho de página                                                                                  |

```tsx
<Field label="Nome" error={errors.name?.message}>
  <Input {...register('name')} invalid={Boolean(errors.name)} />
</Field>
<Button type="submit" loading={isPending}>Salvar</Button>
<LinkButton variant="secondary" to="/pets">Ver pets</LinkButton>
```
