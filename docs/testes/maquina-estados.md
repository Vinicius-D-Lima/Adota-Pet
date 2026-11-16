# Testes: Máquina de estados da solicitação

> Issue [#20](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/20) · prefixo `FSM` · **11 testes** (7 funcionais, 4 de segurança, 0 de integração)

Garante que a solicitação só muda de estado por transições válidas, pela pessoa certa, com histórico auditável.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[FSM-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                                       | Como é testado                                                                   |
| -------- | ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `FSM-01` | Funcional                          | Todas as transições válidas                          | Teste parametrizado com cada linha da tabela de transições.                      |
| `FSM-02` | Funcional                          | Transições inválidas retornam 409                    | Amostra ampla, com a mensagem "transição inválida de X para Y".                  |
| `FSM-03` | Segurança · Autorização por função | Só o responsável avança ou recusa                    | Adotante comum e usuário sem vínculo recebem 403.                                |
| `FSM-04` | Segurança · BOLA/IDOR              | Só o adotante da solicitação cancela                 | Outro usuário e o responsável recebem 403.                                       |
| `FSM-05` | Funcional                          | Recusar exige motivo                                 | Sem `reason` retorna 400.                                                        |
| `FSM-06` | Funcional                          | Histórico de transições                              | Cada transição grava de, para, quem, quando e motivo em `RequestStatusHistory`.  |
| `FSM-07` | Funcional                          | Estados finais não aceitam transição                 | `APROVADA`, `RECUSADA` e `CANCELADA` retornam 409.                               |
| `FSM-08` | Funcional                          | Bloqueio sem agendamento realizado                   | `ENTREVISTA` e `VISITA_DOMICILIAR` não avançam sem o agendamento `REALIZADO`.    |
| `FSM-09` | Segurança · Concorrência           | Transições simultâneas: só uma vence                 | Duas transições em paralelo; a segunda recebe 409 (controle otimista de versão). |
| `FSM-10` | Segurança · XSS                    | `to` e `reason` validados e tratados como texto puro | Valor fora do enum retorna 400; HTML no motivo não é interpretado.               |
| `FSM-11` | Funcional                          | Evento de mudança de estado                          | Cada transição enfileira `RequestStatusChanged`.                                 |

Voltar ao [índice dos testes](README.md).
