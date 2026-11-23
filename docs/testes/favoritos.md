# Testes: Favoritos

> Issue [#51](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/51) · prefixo `FAV` · **7 testes** (5 funcionais, 2 de segurança, 0 de integração)

Garante favoritos idempotentes e isolados por usuário.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[FAV-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

> **Implementados** em [`apps/api/src/favorites.test.ts`](../../apps/api/src/favorites.test.ts). Os 7 testes rodam com `npm test -w @adotapet/api -- src/favorites.test.ts` contra o banco `neondb_test`, preparado automaticamente pelo `global-setup` do Vitest — **sem Docker**. `hasTestDatabase()` pula a suíte quando não há banco de teste configurado.

## Testes

| ID       | Tipo                     | O que verifica                                       | Como é testado                                                                                                         |
| -------- | ------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `FAV-01` | Funcional                | Favoritar é idempotente                              | Duas chamadas resultam no mesmo estado, sem erro e sem duplicar.                                                       |
| `FAV-02` | Funcional                | Desfavoritar o que não estava favoritado retorna 204 | Idempotente também.                                                                                                    |
| `FAV-03` | Funcional                | Pet inexistente retorna 404                          | Ao favoritar.                                                                                                          |
| `FAV-04` | Segurança · BOLA/IDOR    | Cada usuário só vê e altera os próprios favoritos    | A lista e os ids de A nunca incluem favoritos de B.                                                                    |
| `FAV-05` | Segurança · Autenticação | Sem token retorna 401                                | Em todas as quatro rotas.                                                                                              |
| `FAV-06` | Funcional                | Lista paginada com dados resumidos                   | `page`/`limit`, `total` global (não da página), pets `ADOTADO`/`ARQUIVADO` com `status`, resumo sem lat/lng/descrição. |
| `FAV-07` | Funcional                | `/me/favorites/ids` coincide com a lista             | Mesmos ids e mesma ordem; `/ids` continua sem paginação para marcar os cards.                                          |

Voltar ao [índice dos testes](README.md).
