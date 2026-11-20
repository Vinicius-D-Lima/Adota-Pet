# Testes: Padrões transversais da API

> Issue [#47](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/47) · prefixo `INF` · **12 testes** (4 funcionais, 7 de segurança, 1 de integração) — **implementados e passando**

Garante a base que todos os módulos herdam: configuração validada, erros padronizados, CORS, cabeçalhos de segurança, limite de uso, logs sem dados sensíveis, healthcheck, documentação e integração com o banco.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[INF-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador. Os 12 testes estão em [`apps/api/src/infra.test.ts`](../../apps/api/src/infra.test.ts).

## Banco de teste (sem Docker)

O projeto não usa Docker: o Postgres está na nuvem. Antes da suíte, o `globalSetup` do Vitest (`apps/api/test/global-setup.ts`):

1. lê `DATABASE_URL` (ou `TEST_DATABASE_URL`) de `apps/api/.env`/ambiente;
2. cria, se não existir, um **database separado** com sufixo `_test` (padrão: `adotapet_test` → `neondb_test`);
3. roda `prisma migrate deploy` nele (com fallback para `db push`);
4. grava um marcador local para os testes de integração saberem que o banco está pronto.

Os testes nunca apontam para o banco principal. `resetTestDatabase()` trunca as tabelas do banco de teste entre os testes. Sem URL configurada, `INF-11` e `INF-12` são ignorados com aviso; os outros dez continuam rodando. No CI, a URL vem do secret `TEST_DATABASE_URL` (veja `.github/workflows/ci.yml`).

## Testes

| ID       | Tipo                           | O que verifica                                       | Como é testado                                                                                                                                                          |
| -------- | ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INF-01` | Funcional                      | Variável obrigatória ausente derruba a inicialização | `loadConfig` com `DATABASE_URL` ausente/vazia lança `ConfigError` citando a variável; `server.ts` valida antes de abrir a porta.                                        |
| `INF-02` | Funcional                      | Erro de validação usa o formato padrão               | `GET /api/pets?page=abc` retorna 400 com `{ statusCode, error, message, details[] }`, e `details` aponta o campo.                                                       |
| `INF-03` | Segurança · Configuração       | Erro inesperado devolve 500 genérico                 | Força uma exceção no prisma e confere que o corpo não contém stack, caminho de arquivo nem mensagem interna. O detalhe vai só para o log.                               |
| `INF-04` | Segurança · Configuração       | CORS só para a origem do frontend                    | Requisição com `Origin` de outro domínio não recebe `Access-Control-Allow-Origin`; a origem configurada recebe.                                                         |
| `INF-05` | Segurança · Configuração       | Cabeçalhos do helmet presentes                       | Confere `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` em produção e ausência de `X-Powered-By`.                                                        |
| `INF-06` | Segurança · Limite de uso      | Limite global de requisições                         | Excede o limite configurado e espera 429 com `Retry-After` no formato padrão de erro.                                                                                   |
| `INF-07` | Segurança · Limite de uso      | Corpo grande e JSON malformado                       | Corpo acima do limite retorna 413; JSON inválido retorna 400, nunca 500.                                                                                                |
| `INF-08` | Segurança · Exposição de dados | Logs sem dados sensíveis e com id de requisição      | Captura o logger pino, envia senha, token, cookie e CPF e confere que foram redigidos e que cada linha traz `requestId`.                                                |
| `INF-09` | Funcional                      | `GET /health` reflete o banco                        | Com `checkDatabase` injetado: 200 com `{ status: 'ok', database: 'ok' }` e 503 com `{ status: 'error', database: 'unavailable' }`.                                      |
| `INF-10` | Funcional                      | `/docs` serve a OpenAPI completa                     | Compara `listRoutes(app)` com `paths` do documento: toda rota do Express aparece. Os schemas vêm de `@adotapet/shared` via `z.toJSONSchema`.                            |
| `INF-11` | Segurança · Injeção            | Injeção de SQL em parâmetros de consulta             | Envia `' OR 1=1 --` em `search`/`sort` e `'; DROP TABLE users; --` em `city`: nada é interpretado como SQL e as tabelas continuam existindo. Executa no banco de teste. |
| `INF-12` | Integração                     | Teste de integração de exemplo com banco de teste    | Cria um pet com ID único no database `_test`, consulta `GET /api/pets`, limpa as tabelas e confirma que o registro desapareceu.                                         |

## Executar

```bash
# da raiz, com apps/api/.env apontando para o Postgres da nuvem
npm test -w apps/api

# sem banco configurado: 13 testes passam e INF-11/INF-12 são ignorados
npm test -w @adotapet/api
```

Voltar ao [índice dos testes](README.md).
