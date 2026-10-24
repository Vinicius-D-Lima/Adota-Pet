# Testes: CRUD de pets

> Issue [#49](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/49) · prefixo `PET` · **12 testes** (7 funcionais, 5 de segurança, 0 de integração)

Garante listagem pública com filtros, paginação e distância, e escrita restrita à organização dona do pet, com upload seguro de fotos.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[PET-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                                     | Como é testado                                                                                      |
| -------- | ---------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PET-01` | Funcional                          | Filtros combinados                                 | Mesmo resultado da lógica atual de `PetsPage` para espécie, porte e sexo.                           |
| `PET-02` | Funcional                          | Paginação consistente                              | `total` correto, sem itens repetidos ou faltando entre páginas.                                     |
| `PET-03` | Funcional                          | Ordenação por distância                            | `sort=distance` sem `lat`/`lng` retorna 400; com eles, ordem crescente e `distanceKm` em cada item. |
| `PET-04` | Funcional                          | Listagem padrão só com disponíveis                 | Pets `ADOTADO` e `ARQUIVADO` ficam fora, mas `GET /pets/:id` continua respondendo.                  |
| `PET-05` | Funcional                          | Id inexistente retorna 404                         | No formato padrão de erro.                                                                          |
| `PET-06` | Segurança · Autorização por função | Não membro não cria, edita nem arquiva             | Usuário sem vínculo recebe 403 em `POST`, `PUT` e `archive`.                                        |
| `PET-07` | Segurança · BOLA/IDOR              | Membro de outra organização não edita o pet        | Membro da organização A tentando editar pet da B recebe 403.                                        |
| `PET-08` | Segurança · Mass assignment        | `organizationId` e `status` do corpo são ignorados | Evita criar pet em nome de outra organização ou publicar já como adotado.                           |
| `PET-09` | Segurança · Injeção                | Injeção de SQL em `search`, `city` e `sort`        | Payloads clássicos não alteram a consulta nem derrubam o banco.                                     |
| `PET-10` | Segurança · Upload                 | Foto validada pelo conteúdo, tamanho e quantidade  | Um executável renomeado para `.png` retorna 400; mais de 5 MB ou mais de 8 fotos retorna 400.       |
| `PET-11` | Funcional                          | Arquivar em vez de apagar                          | Solicitações e adoções do pet continuam consultáveis.                                               |
| `PET-12` | Funcional                          | Ordem das fotos e capa                             | Reordenar e escolher a capa se refletem em `GET /pets/:id`.                                         |

Voltar ao [índice dos testes](README.md).
