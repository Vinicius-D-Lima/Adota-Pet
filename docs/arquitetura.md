# Arquitetura

## Stack

| Camada               | Tecnologia                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- |
| Interface            | React 18, TypeScript (modo `strict`)                                               |
| Build e dev server   | Vite 6 (com proxy `/api` → API simulada)                                           |
| Rotas                | react-router-dom 7                                                                 |
| Estado do servidor   | TanStack Query v5 (`useQuery`, `useInfiniteQuery`, `useMutation`, devtools em dev) |
| Validação em runtime | Zod 4                                                                              |
| Ícones               | lucide-react                                                                       |
| API simulada         | json-server 0.17.4 (Express por baixo)                                             |
| Testes               | Vitest 5, Testing Library, jsdom, supertest (API simulada)                         |
| Qualidade            | ESLint 9 (flat config), Prettier, GitHub Actions                                   |

Não há biblioteca de estado global nem de CSS: o estado compartilhado vive no cache do TanStack Query, e os estilos são CSS puro (`src/styles.css` e `src/components/ui/ui.css`).

## Estrutura de pastas

```
.
├── .github/workflows/ci.yml      # CI: lint, formatação, tipos, testes e build
├── docs/                         # esta documentação
├── mock-server/                  # API simulada (json-server)
│   ├── server.js                 # rotas, validação e regras de negócio
│   ├── reset.js                  # restaura db.json a partir do seed
│   ├── db.seed.json              # dados iniciais versionados
│   ├── db.json                   # banco em uso (ignorado pelo git)
│   ├── server.test.js            # regras do servidor
│   └── contract.test.js          # respostas reais x schemas do frontend
├── public/favicon.svg
└── src/
    ├── main.tsx                  # entrada: providers, roteador e Error Boundary raiz
    ├── App.tsx                   # rotas, lazy loading e Error Boundary por rota
    ├── types.ts                  # tipos públicos (derivados dos schemas Zod)
    ├── styles.css                # estilos globais
    ├── components/               # componentes da aplicação
    │   └── ui/                   # biblioteca de componentes reutilizáveis
    ├── pages/                    # uma página por rota
    ├── hooks/                    # acesso à API via TanStack Query
    ├── schemas/                  # schemas Zod: contrato de dados do frontend
    ├── lib/                      # cliente HTTP, ApiError e QueryClient
    ├── utils/                    # funções puras (compatibilidade, status, datas...)
    └── test/                     # utilitários e fixtures de teste
```

## Fluxo de dados

```
Página ──usa──▶ hook (TanStack Query) ──chama──▶ api (fetch) ──▶ /api (proxy) ──▶ json-server
   ▲                    │                                                              │
   │                    └── valida a resposta com um schema Zod ◀────────────────────────┘
   └── lê data / isPending / isError do cache
```

1. A **página** nunca chama `fetch`. Ela usa um **hook** (`usePets`, `useFavorites`, `useAdoptionRequests`, `useAdopterProfile`).
2. O hook chama o cliente `api` (`src/lib/api.ts`) e **valida a resposta com um schema Zod**. Se o servidor devolver algo fora do contrato, o erro aparece na hora, não como um `undefined` perdido na tela.
3. O resultado fica no **cache do TanStack Query**, compartilhado por toda a aplicação. O contador do menu, o coração do cartão e a página de favoritos leem o mesmo dado.
4. Mutações (`useMutation`) invalidam ou atualizam o cache, e as telas se atualizam sozinhas.

### Cliente HTTP (`src/lib/api.ts`)

- Métodos `get`, `post`, `put`, `patch` e `delete`, tipados.
- Base da URL em `VITE_API_URL` (padrão `/api`).
- `query` aceita listas e as serializa como parâmetro repetido (`size=Pequeno&size=Médio`).
- Corpo JSON ou `FormData` (multipart, para uploads futuros); resposta `204` devolve `undefined`.
- Suporta `AbortSignal`, e o cancelamento não vira erro de API.

### Erros (`src/lib/ApiError.ts`)

Toda falha vira um `ApiError` com `statusCode`, `message` e `details`:

- `statusCode` **0** representa falha de rede (sem resposta do servidor).
- `fromResponse` tolera corpos fora do padrão.
- `toFieldErrors()` converte `details` em `{ campo: mensagem }`, aceitando `[{ field | path, message }]` ou um objeto.
- `isNetworkError` e `isClientError` ajudam a decidir o que mostrar.

Formato de erro do servidor: `{ statusCode, error, message, details }`.

### Cache e repetição (`src/lib/queryClient.ts`)

- `staleTime` de 60 s e `refetchOnWindowFocus` desligado.
- Repetição automática: erros **4xx não são repetidos**; erros de rede e 5xx são repetidos até 2 vezes.

### Chaves de cache

| Hook                  | Chaves                                                 |
| --------------------- | ------------------------------------------------------ |
| `usePets`, `usePet`   | `['pets', filtros]`, `['pet', id]`                     |
| `useFavorites`        | `['favorites', 'ids']`, `['favorites', 'pets']`        |
| `useAdoptionRequests` | `['adoption-requests', 'list']`, `[..., 'detail', id]` |
| `useAdopterProfile`   | `['adopter-profile']`                                  |

## Schemas e tipos (`src/schemas`)

Os schemas Zod são a **fonte única** do contrato de dados. Os tipos TypeScript (`Pet`, `Profile`, `QuestionnaireAnswers`, `AdoptionRequest`...) são derivados deles e reexportados por `src/types.ts`.

| Schema                | Papel                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `petSchema`           | Pet completo, e a resposta paginada `{ data, total }`                                    |
| `profileSchema`       | Perfil do adotante, com todas as regras de validação (CPF, idade, e-mail...)             |
| `questionnaireSchema` | Respostas do questionário                                                                |
| `requestSchema`       | Solicitação; o pet embutido **não** traz `distance` nem `distanceKm` (só vêm de `/pets`) |

`ProfileDraft` é o perfil como o formulário o enxerga: campos de texto e booleanos podem ser `''` enquanto a pessoa não respondeu.

O arquivo `mock-server/contract.test.js` valida as **respostas reais** do servidor contra estes schemas, para que mock e frontend não se afastem em silêncio.

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

## Funções puras (`src/utils`)

| Arquivo                  | Função                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `calculateCompatibility` | Pontuação e pontos fortes e de atenção (ver [Funcionalidades](funcionalidades.md#compatibilidade-petspetidcompatibilidade)) |
| `requestStatus`          | `canCancelRequest` e `isActiveRequest`                                                                                      |
| `formatRequestDate`      | Data ISO em pt-BR (devolve o texto original se a data for inválida)                                                         |
| `getInitials`            | Iniciais do nome, ignorando "de", "da", "do", "das", "dos" e "e"                                                            |
| `profileFieldLabels`     | Rótulos amigáveis dos campos do perfil                                                                                      |
| `zodFieldErrors`         | Converte erros do Zod em `{ campo: mensagem }`                                                                              |

## Convenções de código

- TypeScript `strict`, com `noUnusedLocals` e `noUnusedParameters`.
- Prettier: sem ponto e vírgula, aspas simples, vírgula final, largura 100.
- Páginas não chamam `fetch`; hooks não conhecem JSX.
- Respostas da API são lidas com `unknown` e validadas por um schema Zod antes de chegar à tela (o perfil do adotante ainda é convertido à mão por `toAdopterProfile`).
- Nomes de domínio em português nas mensagens e rotas; identificadores de código em inglês.
