# Testes: Denúncias e moderação

> Issue [#26](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/26) · prefixo `DEN` · **9 testes** (4 funcionais, 5 de segurança, 0 de integração)

Garante o sigilo do denunciante, a restrição ao moderador e a proteção contra abuso do canal de denúncias.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[DEN-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                                        | Como é testado                                                                     |
| -------- | ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DEN-01` | Segurança · Exposição de dados     | Identidade do denunciante nunca aparece ao denunciado | Nenhuma resposta acessível ao denunciado traz o id, nome ou e-mail do denunciante. |
| `DEN-02` | Segurança · Autorização por função | Só `MODERADOR` lista e resolve                        | Outros usuários recebem 403 em `/moderation/*`.                                    |
| `DEN-03` | Funcional                          | Resolver exige resolução e registra o moderador       | Sem `resolution` retorna 400; o status guarda moderador e data.                    |
| `DEN-04` | Funcional                          | Denúncia procedente contra avaliação a oculta         | A avaliação some e a reputação é recalculada.                                      |
| `DEN-05` | Segurança · Limite de uso          | 6ª denúncia em 24 horas retorna 429                   | Evita uso do canal para assédio.                                                   |
| `DEN-06` | Funcional                          | Uma denúncia aberta por denunciante e alvo            | A duplicada retorna 409.                                                           |
| `DEN-07` | Funcional                          | Orientação dos canais oficiais                        | `MAUS_TRATOS` e `ABANDONO` trazem delegacia, Disque-Denúncia e órgão ambiental.    |
| `DEN-08` | Segurança · Upload                 | Anexos seguem as regras de upload                     | Tipo real, tamanho e quantidade validados como nos check-ins.                      |
| `DEN-09` | Segurança · BOLA/IDOR              | `GET /me/reports` só traz as próprias denúncias       | Usuário B não vê as de A.                                                          |

Voltar ao [índice dos testes](README.md).
