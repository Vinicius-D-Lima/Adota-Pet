# Testes: Fila de jobs (pg-boss)

> Issue [#95](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/95) · prefixo `JOB` · **8 testes** (6 funcionais, 1 de segurança, 1 de integração)

Garante execução confiável de tarefas em segundo plano: retentativa, idempotência, agendamento e atomicidade com o banco.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[JOB-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                           | O que verifica                          | Como é testado                                              |
| -------- | ------------------------------ | --------------------------------------- | ----------------------------------------------------------- |
| `JOB-01` | Integração                     | pg-boss inicia e cria seu schema        | Pela migration, em banco vazio.                             |
| `JOB-02` | Funcional                      | Job executa e conclui                   | Estado final `completed`.                                   |
| `JOB-03` | Funcional                      | Falha gera retentativa e dead letter    | Com backoff; depois do limite, vai para a fila de falhas.   |
| `JOB-04` | Funcional                      | Job idempotente                         | O mesmo evento duas vezes produz um só efeito.              |
| `JOB-05` | Funcional                      | Job agendado dispara no horário         | Com relógio simulado.                                       |
| `JOB-06` | Segurança · Exposição de dados | Payload sem dados sensíveis e validado  | Sem senha nem token; o consumidor valida o payload com Zod. |
| `JOB-07` | Funcional                      | Enfileirar na mesma transação dos dados | Se a transação desfaz, o job não existe.                    |
| `JOB-08` | Funcional                      | Encerramento gracioso                   | Em `SIGTERM`, jobs em andamento terminam antes de sair.     |

Voltar ao [índice dos testes](README.md).
