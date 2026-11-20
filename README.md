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

> A identidade de demonstração ainda é baseada nos cabeçalhos `X-Demo-User-Id` e `X-Demo-Role`; não há autenticação JWT nesta etapa.

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

A API valida a configuração na inicialização e não sobe se faltar variável obrigatória. O banco fica na nuvem; **não há Docker**. `GET /health` devolve 503 quando o banco está fora. Veja [`apps/api/README.md`](apps/api/README.md).

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
| `GET /me/favorites`, `GET /me/favorites/ids`             | Favoritos                                                                                                                                                  |
| `PUT/DELETE /me/favorites/:petId`                        | Adiciona/remove favorito                                                                                                                                   |
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
| `npm run db:generate`                              | Gera o cliente Prisma no workspace da API                    |
| `npm run db:migrate` / `db:deploy` / `db:seed`     | Migrações e seed do banco na API                             |
| `npm run db:studio` / `db:reset` / `db:push`       | Utilitários do Prisma na API                                 |
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
