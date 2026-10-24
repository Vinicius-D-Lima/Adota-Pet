# Testes: Perfil do adotante

> Issue [#18](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/18) · prefixo `PERF` · **8 testes** (5 funcionais, 3 de segurança, 0 de integração)

Garante que o perfil é persistido, validado e acessível somente pelo próprio dono.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[PERF-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo                        | O que verifica                                   | Como é testado                                                                                  |
| --------- | --------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `PERF-01` | Funcional                   | Perfil persiste e sobrevive a reinício           | Grava, reinicia a API e lê o mesmo perfil.                                                      |
| `PERF-02` | Funcional                   | Valores fora do enum retornam 400                | Com a mensagem do campo em `details`.                                                           |
| `PERF-03` | Funcional                   | `isComplete` só é verdadeiro com tudo preenchido | Parametrizado: remove cada atributo do matching e confere `false`.                              |
| `PERF-04` | Segurança · BOLA/IDOR       | Um usuário não lê nem altera o perfil de outro   | Usuário B tenta `GET`/`PUT` no perfil de A e recebe 403/404. Evita acesso a dados de terceiros. |
| `PERF-05` | Segurança · Mass assignment | `userId` no corpo é ignorado                     | O perfil gravado sempre pertence ao usuário autenticado.                                        |
| `PERF-06` | Segurança · Autenticação    | Sem token retorna 401                            | Para `GET` e `PUT`.                                                                             |
| `PERF-07` | Funcional                   | `PUT` parcial não apaga campos                   | Enviar só `housing` mantém os demais atributos.                                                 |
| `PERF-08` | Funcional                   | Seed reproduz o perfil inicial atual             | Os valores do seed coincidem com o `initialProfile` do frontend.                                |

Voltar ao [índice dos testes](README.md).
