# Testes: Monorepo (npm workspaces)

> Issue [#3](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/3) · prefixo `MONO` · **6 verificações** (1 funcional, 5 de integração)

Garante que `apps/web`, `apps/api` e `packages/shared` convivem em um único monorepo npm workspaces e que o contrato Zod é realmente compartilhado.

## Como ler

Cada linha da tabela é uma verificação executada no CI ou em um script da raiz, e não um teste de unidade. O ID (por exemplo `MONO-01`) aparece no nome do passo do workflow ou no script que o executa, para que este documento, a issue e a automação se encontrem pelo mesmo identificador.

## Verificações

| ID        | Tipo       | O que verifica                              | Como é testado                                                                                                                                                                                                                                 |
| --------- | ---------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONO-01` | Integração | `npm ci` na raiz instala os três workspaces | Etapa `MONO-01 - npm ci instala os três workspaces` roda `npm ci`; `npm run check:workspaces` valida `apps/*`, `packages/*`, os nomes `@adotapet/*` e `npm ls`.                                                                                |
| `MONO-02` | Integração | Build do web a partir da raiz               | Etapa `MONO-02 - build do web a partir da raiz` roda `npm run build:web`, que delegando para `@adotapet/web` gera `apps/web/dist/`.                                                                                                            |
| `MONO-03` | Integração | O pacote `shared` é importado por web e api | `apps/web/src/types.ts` e `apps/api/src/validation.ts` importam `@adotapet/shared`; `npm run check:shared-imports` confere os imports e `npm run typecheck` valida os dois.                                                                    |
| `MONO-04` | Funcional  | Mudar o contrato quebra quem não acompanhou | `packages/shared/src/contract.guard.ts` usa `@ts-expect-error` para um perfil sem CPF; `npm run check:contract` roda o typecheck do shared. Se `cpf` deixar de ser obrigatório, o `@ts-expect-error` fica sem erro e a checagem falha.         |
| `MONO-05` | Integração | CI roda cada workspace                      | As etapas `MONO-05 - ...` executam `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` e os builds de shared/api. Cada script da raiz usa `npm run <script> --workspaces --if-present`, então falha em qualquer workspace. |
| `MONO-06` | Integração | Uma única versão das bibliotecas críticas   | Etapa `MONO-06 - uma única versão das bibliotecas críticas` roda `npm run check:deps`, que lê o `package-lock.json` e exige uma versão única de `zod` e `@casl/ability`.                                                                       |

## Onde cada ID aparece

| ID        | Workflow (`.github/workflows/ci.yml`)                                           | Script/local                                                     |
| --------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `MONO-01` | `MONO-01 - npm ci instala os três workspaces`, `MONO-01 - verificar workspaces` | `npm run check:workspaces`                                       |
| `MONO-02` | `MONO-02 - build do web a partir da raiz`                                       | `npm run build:web`                                              |
| `MONO-03` | `MONO-03 - shared importado por web e api`, `MONO-05 - tipos de cada workspace` | `npm run check:shared-imports`, `npm run typecheck`              |
| `MONO-04` | `MONO-04 - contrato quebra quem não acompanhou`                                 | `npm run check:contract`                                         |
| `MONO-05` | Passos `MONO-05 - ...` de lint, formatação, tipos, testes e build               | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| `MONO-06` | `MONO-06 - uma única versão das bibliotecas críticas`                           | `npm run check:deps`                                             |

## Contrato único

`packages/shared/src/index.ts` reexporta os schemas Zod usados por web e api. O frontend importa os tipos por `apps/web/src/types.ts`; a API deriva `PROFILE_FIELDS` de `profileSchema` em `apps/api/src/validation.ts`. Assim, um campo obrigatório alterado no pacote compartilhado aparece como erro de typecheck em qualquer consumidor que não foi atualizado.

Voltar ao [índice dos testes](README.md).
