# Testes: Papéis e permissões (CASL)

> Issue [#28](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/28) · prefixo `RBAC` · **9 testes** (1 funcionais, 8 de segurança, 0 de integração)

Garante a matriz de permissões inteira, com negação por padrão e filtros de consulta pelo `@casl/prisma`.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[RBAC-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo                               | O que verifica                                         | Como é testado                                                                      |
| --------- | ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `RBAC-01` | Segurança · Autorização por função | Cada célula da matriz tem teste                        | Teste parametrizado papel × ação com todas as linhas ✅ e ❌ da matriz.             |
| `RBAC-02` | Segurança · Autorização por função | Voluntário não aprova adoção                           | Retorna 403.                                                                        |
| `RBAC-03` | Segurança · BOLA/IDOR              | Membro da organização A não edita pet da B             | Retorna 403.                                                                        |
| `RBAC-04` | Segurança · Autorização por função | `GET /me/permissions` reflete mudança de papel na hora | Sem precisar de novo login.                                                         |
| `RBAC-05` | Segurança · BOLA/IDOR              | Administrador de uma organização não manda na outra    | Poder vale só dentro da própria organização.                                        |
| `RBAC-06` | Segurança · Autorização por função | `MODERADOR` não ganha permissões de organização        | O papel da plataforma é separado dos papéis de organização.                         |
| `RBAC-07` | Segurança · BOLA/IDOR              | Listagens filtradas por `accessibleBy`                 | As consultas usam `@casl/prisma` e nunca devolvem registros de outras organizações. |
| `RBAC-08` | Segurança · Autorização por função | Rota nova sem regra é negada por padrão                | Deny by default: um endpoint sem regra declarada retorna 403.                       |
| `RBAC-09` | Funcional                          | A matriz do README coincide com as regras              | O teste lê a tabela do README e compara com as regras do CASL.                      |

Voltar ao [índice dos testes](README.md).
