# Testes: Filtros salvos e alertas

> Issue [#31](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/31) · prefixo `FIL` · **9 testes** (7 funcionais, 2 de segurança, 0 de integração)

Garante validação dos critérios, limite por usuário, deduplicação de alertas e isolamento entre usuários.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[FIL-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                  | O que verifica                       | Como é testado                                                               |
| -------- | --------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `FIL-01` | Funcional             | Critérios validados                  | Critério desconhecido ou valor fora do enum retorna 400.                     |
| `FIL-02` | Funcional             | 11º filtro retorna 409               | Limite de 10 por usuário.                                                    |
| `FIL-03` | Funcional             | Pet que bate gera uma notificação    | Uma só para o dono do filtro.                                                |
| `FIL-04` | Funcional             | Filtro inativo não alerta            | Mesmo que o pet bata.                                                        |
| `FIL-05` | Funcional             | Deduplicação entre filtros           | O mesmo pet não alerta duas vezes quando bate com vários filtros do usuário. |
| `FIL-06` | Segurança · BOLA/IDOR | Só o dono lê, edita e apaga o filtro | Outro usuário recebe 403 ou 404.                                             |
| `FIL-07` | Segurança · Injeção   | `criteria` validado por schema       | Chaves arbitrárias e `__proto__` são recusadas. Evita poluição de protótipo. |
| `FIL-08` | Funcional             | Não notifica a própria organização   | Membros de quem cadastrou o pet ficam de fora.                               |
| `FIL-09` | Funcional             | Resumo diário por e-mail             | Disparado pelo job agendado do pg-boss.                                      |

Voltar ao [índice dos testes](README.md).
