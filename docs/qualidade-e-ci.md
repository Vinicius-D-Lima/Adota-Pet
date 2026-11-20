# Qualidade, testes e CI

## Scripts

| Script                         | O que faz                                                   |
| ------------------------------ | ----------------------------------------------------------- |
| `npm run lint`                 | ESLint em todos os workspaces                               |
| `npm run lint:fix`             | ESLint corrigindo o que for possível em todos os workspaces |
| `npm run format`               | Prettier reescrevendo os arquivos                           |
| `npm run format:check`         | Prettier só verificando (é o que o CI usa)                  |
| `npm run typecheck`            | Typecheck de `apps/web`, `apps/api` e `packages/shared`     |
| `npm test`                     | Vitest dos três workspaces, em execução única               |
| `npm run test:watch`           | Vitest em modo watch do web                                 |
| `npm run build`                | Build de shared → web → api a partir da raiz                |
| `npm run check:workspaces`     | MONO-01: workspaces declarados e instalados                 |
| `npm run check:shared-imports` | MONO-03: shared importado por web e api                     |
| `npm run check:deps`           | MONO-06: versão única de `zod` e `@casl/ability`            |
| `npm run check:contract`       | MONO-04: guarda de contrato no typecheck do shared          |

## Verificações locais antes de abrir um PR

Rode na mesma ordem do CI:

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

## Integração contínua

O workflow `.github/workflows/ci.yml` roda em **todo pull request** e em **push na `main`**, no Node 22. Ele instala os três workspaces e executa, para **cada workspace**, lint, formatação, tipos, testes e build. Os nomes dos passos carregam os IDs `MONO-01` a `MONO-06`; veja o [catálogo do monorepo](testes/monorepo.md).

Há também o job **Backend — #47 padrões e #48 autenticação**, com lint, typecheck, testes e build da API. Ele usa os secrets `DATABASE_URL` (admin) e `TEST_DATABASE_URL` (database terminando em `_test`). Sem eles, `INF-11`, `INF-12` e os 16 testes `AUTH-*` são ignorados com aviso e os outros 13 testes da API continuam valendo; configure os secrets para que a integração com o banco e a autenticação também rodem no CI. O projeto não usa Docker.

- **Ele só valida. Não há deploy** (nem preview) em lugar nenhum.
- Em pull requests, o GitHub executa o workflow sobre o **resultado da mescla com a branch de destino**. Por isso um PR pode passar sozinho e quebrar depois de outro entrar, e por isso vale atualizar o PR com a `dev` e esperar o CI antes de mesclar.
- Em PR com conflito, o workflow não roda até o conflito ser resolvido.

## Lint e formatação

- **ESLint 9** com configuração plana (`eslint.config.js`): regras recomendadas do JavaScript e do typescript-eslint, `react-hooks`, `react-refresh` e **`jsx-a11y`** (acessibilidade estática, com `Input`, `Select` e `Textarea` reconhecidos como controles).
- **Prettier:** sem ponto e vírgula, aspas simples, vírgula final em tudo e largura de 100 colunas. O `eslint-config-prettier` evita conflito entre as duas ferramentas.
- O Prettier também confere os arquivos Markdown, inclusive esta documentação.

## Tailwind

O Tailwind é processado pelo Vite (`@tailwindcss/vite`), então não há `tailwind.config` nem etapa extra no CI: o `npm run build` falha se `apps/web/src/index.css` quebrar. Uma classe que não existe simplesmente não aplica, sem erro. Por isso o visual das telas alteradas deve ser conferido no navegador.

## TypeScript

Modo `strict`, com `noUnusedLocals`, `noUnusedParameters` e `noFallthroughCasesInSwitch` em todos os workspaces. Cada pacote tem seu `tsconfig.json`; o web usa `tsconfig.app.json`/`tsconfig.node.json` com `noEmit`, e os `*.tsbuildinfo` ficam fora do git. O build do `@adotapet/shared` roda antes do typecheck de web e api para que os `.d.ts` estejam disponíveis.

## Testes

- **Ferramentas:** Vitest 5, Testing Library (`@testing-library/react`, `jest-dom`, `user-event`), jsdom e supertest.
- **Execução:** `npm test` delega para `vitest run` de cada workspace; a suíte atual passeia por web (jsdom + mock-server), api (node + supertest) e shared (schemas).
- **Onde ficam:** ao lado do código (`Componente.test.tsx`), mais `apps/web/src/test/` para utilitários, `apps/web/mock-server/*.test.js` para a API simulada, `apps/api/src/*.test.ts` para a API real e `packages/shared/src/*.test.ts` para os schemas.

### Estratégia

| Camada                  | O que se testa                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Funções puras (`utils`) | Compatibilidade (incluindo 100%, 86%, 71% e 43%), status, datas, iniciais                                                                 |
| Hooks                   | Listagem de pets e favoritos (otimista, fila, falha e desfazer)                                                                           |
| Páginas                 | Estados de carregamento, erro e vazio; filtros na URL; questionário; solicitações; perfil; bloqueio de duplicadas                         |
| Componentes             | Biblioteca de UI (classes do Tailwind, `cx` e repasse de `ref` ao react-hook-form), `ErrorBoundary`, `ConfirmDialog`, `Layout`, `PetCard` |
| Cliente HTTP            | Montagem de URL, listas em `query`, erros e `204`                                                                                         |
| API simulada            | Regras de negócio e todos os códigos de erro                                                                                              |
| **Contrato**            | Respostas reais do mock contra os schemas Zod de `@adotapet/shared`                                                                       |
| **API real (infra)**    | `INF-01` a `INF-12`: config, erros, CORS, helmet, rate limit, body, logs, health, OpenAPI, injeção e integração com banco de teste        |

Os testes da API gravam em um database separado do Postgres na nuvem, criado pelo `globalSetup` do Vitest e limpo entre os testes; veja [infra-api.md](testes/infra-api.md).

### Utilitários de teste (`apps/web/src/test`)

- `renderWithProviders(ui, { route })`: renderiza dentro de `QueryClientProvider` (sem repetição) e `MemoryRouter`, e devolve o `queryClient`.
- `fixtures/pets.ts`, `fixtures/profile.ts`, `fixtures/requests.ts` e `petFixture.ts`: dados de exemplo (`makeRequest`, `validProfile`, `petFixtures`).
- `fakeFavoritesApi.ts`: simula os endpoints de favoritos sobre um `api` mockado, com estado, atraso e falha configuráveis.

### Convenções e armadilhas

- As páginas são testadas com `vi.mock('../lib/api')`, trocando só a camada de rede.
- Testes do servidor e do contrato usam `// @vitest-environment node`; o resto roda em `jsdom`.
- **O TanStack Query avisa os componentes em um `setTimeout(0)`.** Depois de mexer no cache direto (`setQueryData`, `invalidateQueries`) é preciso esperar esse tick, dentro de `act`, antes de verificar a tela. Sem isso o teste pode passar com o código errado.
- Regra de ouro: **todo teste novo deve falhar quando a correção é desfeita.** Vários bugs do projeto foram encontrados assim.

## Fluxo de branches e PRs

```
main        ← versão estável; o CI roda em push
  ▲
dev         ← integração; todos os PRs apontam para cá
  ▲
feat/…  fix/…  docs/…     ← uma branch por tarefa (normalmente uma issue)
```

- Todo trabalho sai de `dev` e **volta para `dev`** por pull request. A `main` só recebe da `dev`.
- Issues fecham automaticamente só quando o PR chega na **branch padrão** (`main`). Como os PRs apontam para a `dev`, as issues foram fechadas à mão quando o PR ficou pronto.
- **Conflitos:** resolva trazendo a `dev` para a branch do PR (`git merge origin/dev`), **sem rebase nem force-push**, para não invalidar o trabalho de quem já baixou a branch. O commit de mescla fica no histórico.
- **Ordem de mescla:** mescle primeiro os PRs pequenos e independentes e deixe por último o que mexe em muitos arquivos (como a componentização, #79). Assim a resolução pesada acontece uma única vez.
- Antes de mesclar o próximo PR: atualize com a `dev`, rode as verificações e espere o CI.
- Mensagens de commit seguem o estilo `feat:`, `fix:`, `docs:`.

## Como investigar um problema

1. Reproduza no navegador com `npm run dev:mock` (e `npm run mock:reset` se os dados estiverem estranhos).
2. Confira a aba Network: o contrato da resposta bate com o schema Zod?
3. Escreva um teste que falha, corrija e confirme que ele passa.
4. Rode a bateria completa da seção "Verificações locais".
