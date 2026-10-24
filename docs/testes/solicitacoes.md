# Testes: Criação e leitura de solicitações

> Issue [#50](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/50) · prefixo `REQ` · **10 testes** (6 funcionais, 4 de segurança, 0 de integração)

Garante as regras do questionário, a solicitação ativa única por pet e o acesso restrito às partes.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[REQ-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                        | O que verifica                                        | Como é testado                                                                                                    |
| -------- | --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `REQ-01` | Funcional                   | Regras do questionário                                | Cada regra violada retorna 400 com o campo em `details`.                                                          |
| `REQ-02` | Funcional                   | Uma solicitação ativa por adotante e pet              | A segunda retorna 409; depois de cancelada ou recusada, uma nova é aceita.                                        |
| `REQ-03` | Funcional                   | Pet adotado ou arquivado retorna 409                  | Para qualquer um dos dois estados.                                                                                |
| `REQ-04` | Funcional                   | Perfil incompleto retorna 422                         | Com a lista dos campos faltantes.                                                                                 |
| `REQ-05` | Segurança · BOLA/IDOR       | Usuário sem vínculo não lê a solicitação              | `GET /requests/:id` retorna 403 para quem não é o adotante nem membro da organização do pet.                      |
| `REQ-06` | Segurança · Mass assignment | `status`, `adopterId` e `id` do corpo são ignorados   | O estado inicial é sempre `ENVIADA` e o adotante é o usuário autenticado.                                         |
| `REQ-07` | Segurança · Concorrência    | Duas requisições simultâneas criam só uma solicitação | Dispara duas em paralelo para o mesmo pet; um índice único parcial garante uma só. Evita duplicidade por corrida. |
| `REQ-08` | Funcional                   | Ids únicos e data do servidor                         | Os ids nunca se repetem e a data é a do momento da criação.                                                       |
| `REQ-09` | Segurança · XSS             | Respostas do questionário tratadas como texto puro    | Um `<script>` no texto é devolvido literalmente, sem interpretação.                                               |
| `REQ-10` | Funcional                   | Evento para a organização                             | Criar a solicitação enfileira `NewRequestForOrganization`.                                                        |

Voltar ao [índice dos testes](README.md).
