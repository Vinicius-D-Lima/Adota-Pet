# Testes: Padrões transversais da API

> Issue [#47](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/47) · prefixo `INF` · **12 testes** (4 funcionais, 7 de segurança, 1 de integração)

Garante a base que todos os módulos herdam: configuração validada, erros padronizados, CORS, cabeçalhos de segurança, limite de uso, logs sem dados sensíveis, healthcheck e documentação.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[INF-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                           | O que verifica                                       | Como é testado                                                                                                                                                           |
| -------- | ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INF-01` | Funcional                      | Variável obrigatória ausente derruba a inicialização | Sobe a API sem `DATABASE_URL` e espera falha imediata com mensagem que cita a variável.                                                                                  |
| `INF-02` | Funcional                      | Erro de validação usa o formato padrão               | Corpo inválido retorna 400 com `{ statusCode, error, message, details[] }`, e `details` aponta o campo.                                                                  |
| `INF-03` | Segurança · Configuração       | Erro inesperado devolve 500 genérico                 | Força uma exceção e confere que a resposta não contém stack trace, caminho de arquivo nem mensagem do ORM. Evita vazamento de detalhes internos.                         |
| `INF-04` | Segurança · Configuração       | CORS só para a origem do frontend                    | Requisição com `Origin` de outro domínio não recebe `Access-Control-Allow-Origin`; a origem configurada recebe.                                                          |
| `INF-05` | Segurança · Configuração       | Cabeçalhos do helmet presentes                       | Confere `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` em produção e ausência de `X-Powered-By`.                                                         |
| `INF-06` | Segurança · Limite de uso      | Limite global de requisições                         | Excede o limite e espera 429 com `Retry-After`. Evita esgotamento de recursos.                                                                                           |
| `INF-07` | Segurança · Limite de uso      | Corpo grande e JSON malformado                       | Corpo acima do limite retorna 413; JSON inválido retorna 400, nunca 500.                                                                                                 |
| `INF-08` | Segurança · Exposição de dados | Logs sem dados sensíveis e com id de requisição      | Faz login e confere que o log não contém senha, token, cookie nem CPF, e que cada linha traz `requestId`.                                                                |
| `INF-09` | Funcional                      | `GET /health` reflete o banco                        | 200 com o banco no ar e 503 com o banco parado.                                                                                                                          |
| `INF-10` | Funcional                      | `/docs` serve a OpenAPI completa                     | Toda rota registrada no Express aparece na especificação.                                                                                                                |
| `INF-11` | Segurança · Injeção            | Injeção de SQL em parâmetros de consulta             | Envia `' OR 1=1 --` e `'; DROP TABLE users; --` em `search`, `city` e `sort`: o resultado não muda e a tabela continua existindo (consultas parametrizadas pelo Prisma). |
| `INF-12` | Integração                     | Teste de integração de exemplo com banco de teste    | Roda contra o Postgres do compose e limpa os dados entre testes.                                                                                                         |

Voltar ao [índice dos testes](README.md).
