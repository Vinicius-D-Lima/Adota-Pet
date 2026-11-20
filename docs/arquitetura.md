# Arquitetura

## Stack

| Camada                 | Tecnologia                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Interface              | React 18, TypeScript (modo `strict`)                                                 |
| Build e dev server     | Vite 6 (`apps/web`, com proxy `/api` → API em 3002 ou mock em 3001)                  |
| Rotas                  | react-router-dom 7                                                                   |
| Estado do servidor     | TanStack Query v5 (`useQuery`, `useInfiniteQuery`, `useMutation`, devtools em dev)   |
| Estilos                | Tailwind CSS 4 (plugin `@tailwindcss/vite`, tokens no `@theme`), `tailwind-merge`    |
| Formulários            | react-hook-form 7 + `@hookform/resolvers` (`zodResolver`)                            |
| Validação em runtime   | Zod 4                                                                                |
| Ícones                 | lucide-react                                                                         |
| API simulada           | json-server 0.17.4 (Express por baixo)                                               |
| Backend                | Express 5 + TypeScript (`@adotapet/api` em `apps/api/`, CORS restrito, helmet, pino) |
| Contrato compartilhado | schemas Zod em `@adotapet/shared` (`packages/shared/`)                               |
| Banco de dados         | PostgreSQL na nuvem (Neon) + Prisma 7 (migrations, database `_test` para testes)     |
| Testes                 | Vitest 5, Testing Library, jsdom, supertest (API simulada e backend)                 |
| Qualidade              | ESLint 9 (flat config), Prettier, GitHub Actions                                     |

A API segue camadas por módulo: `routes/` (HTTP) → serviços/funções de domínio → `db.ts` (acesso a dados). A infraestrutura é transversal: `config.ts` valida o ambiente antes de abrir a porta, `validate.ts` aplica os schemas compartilhados nas entradas, `http.ts` padroniza saídas de erro, `logger.ts` registra cada requisição com `requestId` e `openapi.ts` gera a documentação das rotas reais. Não há Docker: banco de desenvolvimento e de teste ficam no Neon.

Não há biblioteca de estado global: o estado compartilhado vive no cache do TanStack Query. Os estilos são classes utilitárias do **Tailwind CSS 4**, com os tokens do projeto (cores, fontes e sombra) declarados em `apps/web/src/index.css`. Os formulários (questionário e perfil) usam **react-hook-form** com o mesmo schema Zod do contrato.

## Estrutura de pastas

```
.
├── .github/workflows/ci.yml       # CI com os IDs MONO-01 a MONO-06
├── docs/                          # esta documentação
├── scripts/                       # checagens MONO-01, MONO-03, MONO-04, MONO-06
├── apps/
│   ├── web/                       # @adotapet/web — React + Vite
│   │   ├── mock-server/           # API simulada (json-server), seed e testes
│   │   ├── scripts/               # dev-mock.js
│   │   ├── src/
│   │   │   ├── main.tsx           # providers, roteador e Error Boundary raiz
│   │   │   ├── App.tsx            # rotas, lazy loading e Error Boundary por rota
│   │   │   ├── types.ts           # reexporta os tipos de @adotapet/shared
│   │   │   ├── index.css          # Tailwind: @import, tokens (@theme) e base
│   │   │   ├── components/        # componentes da aplicação
│   │   │   │   └── ui/            # biblioteca de componentes reutilizáveis
│   │   │   ├── pages/             # uma página por rota
│   │   │   ├── hooks/             # acesso à API via TanStack Query
│   │   │   ├── lib/               # cliente HTTP, ApiError e QueryClient
│   │   │   ├── utils/             # funções puras (compatibilidade, status, datas...)
│   │   │   └── test/              # utilitários e fixtures de teste
│   │   ├── index.html
│   │   └── vite.config.ts         # proxy /api → 3002 (api) ou 3001 (mock)
│   └── api/                       # @adotapet/api — Express + Prisma
│       ├── prisma/
│       │   ├── schema.prisma      # contrato de dados (models)
│       │   ├── migrations/        # migrations versionadas
│       │   └── seed.ts            # dados iniciais (db:seed)
│       ├── prisma.config.ts       # configuração do Prisma CLI
│       ├── test/                  # setup do database _test e limpeza entre testes
│       └── src/
│           ├── app.ts             # helmet, CORS, JSON, logs, rate limit, erros, rotas
│           ├── config.ts          # variáveis validadas por Zod (fail-fast)
│           ├── logger.ts          # pino com requestId e redação de dados sensíveis
│           ├── validate.ts        # body/query/params via @adotapet/shared
│           ├── http.ts            # erro padrão { statusCode, error, message, details? }
│           ├── openapi.ts         # /docs e /docs/openapi.json
│           ├── routes/            # routers sob /api e /health
│           ├── context.ts         # usuário de demonstração via cabeçalhos
│           ├── db.ts              # cliente Prisma (adapter pg)
│           ├── server.ts          # valida config, listen (PORT, padrão 3002)
│           └── infra.test.ts      # testes INF-01 a INF-12 (supertest)
└── packages/
    └── shared/                    # @adotapet/shared — contrato único
        └── src/                   # schemas Zod e index.ts
```

## Fluxo de dados

```
Página ──usa──▶ hook (TanStack Query) ──chama──▶ api (fetch) ──▶ /api (proxy do Vite)
   ▲                    │                                             │
   │                    │                                             ├──▶ @adotapet/api (3002, padrão)
   │                    │                                             └──▶ mock-server (3001, dev:mock)
   │                    └── valida a resposta com @adotapet/shared ◀────┘
   └── lê data / isPending / isError do cache
```

1. A **página** nunca chama `fetch`. Ela usa um **hook** (`usePets`, `useFavorites`, `useAdoptionRequests`, `useAdopterProfile`).
2. O hook chama o cliente `api` (`apps/web/src/lib/api.ts`) e **valida a resposta com um schema de `@adotapet/shared`**. Se o servidor devolver algo fora do contrato, o erro aparece na hora, não como um `undefined` perdido na tela.
3. O resultado fica no **cache do TanStack Query**, compartilhado por toda a aplicação. O contador do menu, o coração do cartão e a página de favoritos leem o mesmo dado.
4. Mutações (`useMutation`) invalidam ou atualizam o cache, e as telas se atualizam sozinhas.

### Cliente HTTP (`apps/web/src/lib/api.ts`)

- Métodos `get`, `post`, `put`, `patch` e `delete`, tipados.
- Base da URL em `VITE_API_URL` (padrão `/api`).
- `query` aceita listas e as serializa como parâmetro repetido (`size=Pequeno&size=Médio`).
- Corpo JSON ou `FormData` (multipart, para uploads futuros); resposta `204` devolve `undefined`.
- Suporta `AbortSignal`, e o cancelamento não vira erro de API.

### Erros (`apps/web/src/lib/ApiError.ts`)

Toda falha vira um `ApiError` com `statusCode`, `message` e `details`:

- `statusCode` **0** representa falha de rede (sem resposta do servidor).
- `fromResponse` tolera corpos fora do padrão.
- `toFieldErrors()` converte `details` em `{ campo: mensagem }`, aceitando `[{ field | path, message }]` ou um objeto.
- `isNetworkError` e `isClientError` ajudam a decidir o que mostrar.

Formato de erro do servidor: `{ statusCode, error, message, details }`.

### Cache e repetição (`apps/web/src/lib/queryClient.ts`)

- `staleTime` de 60 s e `refetchOnWindowFocus` desligado.
- Repetição automática: erros **4xx não são repetidos**; erros de rede e 5xx são repetidos até 2 vezes.

### Chaves de cache

| Hook                  | Chaves                                                 |
| --------------------- | ------------------------------------------------------ |
| `usePets`, `usePet`   | `['pets', filtros]`, `['pet', id]`                     |
| `useFavorites`        | `['favorites', 'ids']`, `['favorites', 'pets']`        |
| `useAdoptionRequests` | `['adoption-requests', 'list']`, `[..., 'detail', id]` |
| `useAdopterProfile`   | `['adopter-profile']`                                  |

## Schemas e tipos (`packages/shared`)

Os schemas Zod são a **fonte única** do contrato de dados. Eles vivem em `@adotapet/shared`, são exportados por `packages/shared/src/index.ts` e são importados por `apps/web` e `apps/api`. Os tipos TypeScript (`Pet`, `Profile`, `QuestionnaireAnswers`, `AdoptionRequest`...) são derivados deles e reexportados ao frontend por `apps/web/src/types.ts`.

| Schema                | Papel                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `petSchema`           | Pet completo, e a resposta paginada `{ data, total }`                                    |
| `profileSchema`       | Perfil do adotante, com todas as regras de validação (CPF, idade, e-mail...)             |
| `questionnaireSchema` | Respostas do questionário                                                                |
| `requestSchema`       | Solicitação; o pet embutido **não** traz `distance` nem `distanceKm` (só vêm de `/pets`) |

`ProfileDraft` é o perfil como o formulário o enxerga: campos de texto e booleanos podem ser `''` enquanto a pessoa não respondeu.

O arquivo `apps/web/mock-server/contract.test.js` valida as **respostas reais** do mock contra estes schemas compartilhados, para que mock, frontend e API não se afastem em silêncio. A API também deriva `PROFILE_FIELDS` de `profileSchema` em `apps/api/src/validation.ts` (MONO-03).

## Autenticação na API (`apps/api/src/auth.ts`)

O módulo de autenticação (#48) implementa a decisão 22 com `jose` (JWT HS256, algoritmo fixo na verificação) e `@node-rs/argon2` (hash `$argon2id$`). `POST /auth/register`, `/auth/login`, `/auth/refresh` e `/auth/logout` são espelhados em `/api/auth/*`; `GET /me` devolve o usuário autenticado.

- `requireAuth` valida o Bearer, consulta o usuário e preenche `req.auth` (claims) e `req.user` (linha do banco). `currentUser` prefere essa identidade; `X-Demo-User-Id` continua apenas como transição para os módulos legados até a #4.
- O access token (~15 min) traz `sub`, `type: 'access'` e `platformRole`. O refresh é um token opaco de 48 bytes: o cookie guarda o original e o banco (`RefreshToken`) guarda só o SHA-256, com `revokedAt` para revogação e detecção de reuso.
- `platformRole` (`USUARIO`/`MODERADOR`) é novo e distinto de `role`/`roles`, que pertencem ao contrato do mock-server e ainda alimentam a área da instituição.
- Os schemas `registerSchema` e `authLoginSchema` vivem em `@adotapet/shared` e são usados na validação de entrada e na OpenAPI.

## Roteamento e carregamento

- `main.tsx`: `ErrorBoundary` → `QueryClientProvider` → `BrowserRouter` → `App` (e as devtools do TanStack Query só em desenvolvimento).
- `App.tsx`: busca o perfil para o `Layout`, e envolve as rotas em `ErrorBoundary` (com `resetKeys` na rota) e `Suspense`.
- Todas as páginas são carregadas com `React.lazy`, e o build gera um arquivo por página.
- A rota `*` mostra a página 404.

## Estado local x estado do servidor

- **Servidor:** tudo o que vem da API fica no TanStack Query.
- **URL:** os filtros da busca ficam em `useSearchParams`.
- **Local:** só o que é temporário e de uma tela (campos do formulário, menu aberto, modal aberto).
- `useDebouncedValue` atrasa a busca por texto; `useFavoriteNotice` guarda o aviso de erro dos favoritos em um pequeno store externo (`useSyncExternalStore`).

## Favoritos otimistas

`useToggleFavorite` atualiza o cache antes da resposta, enfileira as chamadas (`scope`) para que cheguem na ordem dos cliques, desfaz **só o pet** que falhou, mostra um aviso e só ressincroniza com o servidor quando a última mutação da fila termina.

## Funções puras (`apps/web/src/utils`)

| Arquivo                  | Função                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `calculateCompatibility` | Pontuação e pontos fortes e de atenção (ver [Funcionalidades](funcionalidades.md#compatibilidade-petspetidcompatibilidade)) |
| `requestStatus`          | `canCancelRequest` e `isActiveRequest`                                                                                      |
| `formatRequestDate`      | Data ISO em pt-BR (devolve o texto original se a data for inválida)                                                         |
| `getInitials`            | Iniciais do nome, ignorando "de", "da", "do", "das", "dos" e "e"                                                            |
| `profileFieldLabels`     | Rótulos amigáveis dos campos do perfil                                                                                      |

## Convenções de código

- TypeScript `strict`, com `noUnusedLocals` e `noUnusedParameters`.
- Estilos: classes do Tailwind direto no JSX; para juntar classes condicionais use `cx` (`tailwind-merge`), e não concatenação de strings. Cores e fontes vêm dos tokens (`bg-forest-800`, `text-muted`, `font-display`), e valores soltos só quando o token não existe.
- Formulários: `useForm` com `zodResolver(schema)`; campos registrados com `register` nos componentes `Input`, `Select`, `Textarea` e `Checkbox` (que repassam a `ref`); erros de servidor (400) entram com `setError`.
- Prettier: sem ponto e vírgula, aspas simples, vírgula final, largura 100.
- Páginas não chamam `fetch`; hooks não conhecem JSX.
- Respostas da API são lidas com `unknown` e validadas por um schema Zod antes de chegar à tela (o perfil do adotante ainda é convertido à mão por `toAdopterProfile`).
- Nomes de domínio em português nas mensagens e rotas; identificadores de código em inglês.
