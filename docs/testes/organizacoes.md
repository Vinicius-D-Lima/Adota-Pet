# Testes: Organizações, membros e convites

> Issue [#27](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/27) · prefixo `ORG` · **9 testes** (5 funcionais, 4 de segurança, 0 de integração)

Garante criação de organização, convites seguros, a regra do último administrador e o isolamento entre organizações.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[ORG-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                                 | Como é testado                                                      |
| -------- | ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| `ORG-01` | Funcional                          | Quem cria a organização vira administrador     | O criador recebe o papel `ADMIN` automaticamente.                   |
| `ORG-02` | Funcional                          | A organização mantém ao menos um administrador | Remover ou rebaixar o último `ADMIN` retorna 409.                   |
| `ORG-03` | Funcional                          | Convite inválido                               | Token expirado, revogado ou já usado retorna 410 ou 400.            |
| `ORG-04` | Segurança · Autenticação           | Convite só aceito pela conta convidada         | Aceitar com uma conta de e-mail diferente do convidado é rejeitado. |
| `ORG-05` | Segurança · Autenticação           | Token de convite não é adivinhável             | Tem alta entropia (pelo menos 128 bits) e é guardado só como hash.  |
| `ORG-06` | Segurança · Autorização por função | Só `ADMIN` convida, remove e altera papéis     | Voluntário e adotante recebem 403.                                  |
| `ORG-07` | Funcional                          | Pets migram para chave estrangeira             | Os pets do seed apontam para organizações reais.                    |
| `ORG-08` | Segurança · BOLA/IDOR              | Isolamento entre organizações                  | Quem é membro da A não lê nem altera dados da B.                    |
| `ORG-09` | Funcional                          | Convite expira em 7 dias                       | Com relógio simulado.                                               |

Voltar ao [índice dos testes](README.md).
