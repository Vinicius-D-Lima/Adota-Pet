# Testes: Agendamento de entrevista e visita

> Issue [#21](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/21) · prefixo `AGD` · **9 testes** (7 funcionais, 2 de segurança, 0 de integração)

Garante o fluxo de proposta, confirmação, remarcação e realização, com permissões por parte.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[AGD-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                           | Como é testado                                                                                                    |
| -------- | ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `AGD-01` | Funcional                          | Agendamento só no estado correto         | `VISITA_DOMICILIAR` só com a solicitação nesse estado; o mesmo para `ENTREVISTA`.                                 |
| `AGD-02` | Funcional                          | Horários no passado e quantidade         | Passado retorna 400; aceita de 1 a 3 horários propostos.                                                          |
| `AGD-03` | Funcional                          | Adotante só confirma horário proposto    | Qualquer outro horário retorna 400.                                                                               |
| `AGD-04` | Funcional                          | `REALIZADO` antes da data é rejeitado    | Com relógio simulado.                                                                                             |
| `AGD-05` | Segurança · Autorização por função | Cada ação só para quem pode              | Só o responsável propõe e marca como realizado; só o adotante confirma ou pede remarcação; terceiros recebem 403. |
| `AGD-06` | Funcional                          | Fluxo propor, confirmar, realizar        | Caminho feliz completo.                                                                                           |
| `AGD-07` | Funcional                          | Fluxo de remarcação                      | Pedido de remarcação volta ao responsável com novos horários.                                                     |
| `AGD-08` | Funcional                          | Datas em UTC e ISO 8601                  | Gravadas em UTC e devolvidas em ISO 8601.                                                                         |
| `AGD-09` | Segurança · BOLA/IDOR              | Usuário sem vínculo não lê o agendamento | Retorna 403.                                                                                                      |

Voltar ao [índice dos testes](README.md).
