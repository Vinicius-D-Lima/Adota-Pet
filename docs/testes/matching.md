# Testes: Matching e ranking de compatibilidade

> Issue [#19](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/19) · prefixo `MATCH` · **9 testes** (7 funcionais, 2 de segurança, 0 de integração)

Garante que o backend reproduz o cálculo atual do frontend, acrescenta o tempo disponível e ranqueia só pets disponíveis.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[MATCH-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID         | Tipo                      | O que verifica                               | Como é testado                                                                        |
| ---------- | ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `MATCH-01` | Funcional                 | Regressão contra o cálculo atual             | Mesmo perfil e mesmos pets dão os mesmos scores que `calculateCompatibility`.         |
| `MATCH-02` | Funcional                 | Critério novo de tempo disponível            | Pet de energia alta com perfil de até 1 hora vira ponto de atenção.                   |
| `MATCH-03` | Funcional                 | Níveis e limites                             | Alta a partir de 80%, média a partir de 55%, baixa abaixo disso; testa 79/80 e 54/55. |
| `MATCH-04` | Funcional                 | Ranking decrescente com filtros              | `species` e `size` filtram e a lista vem do maior para o menor score.                 |
| `MATCH-05` | Funcional                 | Perfil incompleto retorna 422                | Com a lista de campos faltantes.                                                      |
| `MATCH-06` | Funcional                 | Adotados e indisponíveis ficam fora          | Não aparecem em `/me/matches`.                                                        |
| `MATCH-07` | Funcional                 | Trocar a estratégia não toca nos controllers | Uma `MatchingStrategy` alternativa funciona só trocando a injeção.                    |
| `MATCH-08` | Segurança · Limite de uso | `limit` com teto e parâmetros inválidos      | `limit=1000000` é limitado ou recusado com 400. Evita consumo excessivo.              |
| `MATCH-09` | Segurança · BOLA/IDOR     | Só calcula com o perfil do próprio usuário   | Sem token retorna 401; não há como informar o perfil de outro usuário.                |

Voltar ao [índice dos testes](README.md).
