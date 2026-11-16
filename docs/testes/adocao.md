# Testes: Adoção e plano de acompanhamento

> Issue [#23](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/23) · prefixo `ADOC` · **8 testes** (5 funcionais, 3 de segurança, 0 de integração)

Garante que aprovar cria exatamente uma adoção, de forma atômica, e que o plano gera as datas corretas.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[ADOC-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo                               | O que verifica                                | Como é testado                                                                                                |
| --------- | ---------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ADOC-01` | Funcional                          | Aprovar cria exatamente uma adoção            | Aprovar duas vezes (ou em paralelo) não duplica.                                                              |
| `ADOC-02` | Funcional                          | Pet adotado sai da listagem e do matching     | Some de `/pets` e `/me/matches`.                                                                              |
| `ADOC-03` | Funcional                          | Datas do plano nos valores-limite             | Duração igual ao intervalo e duração não múltipla do intervalo.                                               |
| `ADOC-04` | Segurança · Autorização por função | Só membros criam e editam o plano             | O adotante só visualiza e recebe 403 ao tentar editar.                                                        |
| `ADOC-05` | Funcional                          | Editar o plano preserva check-ins enviados    | Os já enviados não são apagados.                                                                              |
| `ADOC-06` | Funcional                          | Encerramento automático                       | O acompanhamento termina quando o último check-in previsto é revisado.                                        |
| `ADOC-07` | Segurança · BOLA/IDOR              | Cada lista só mostra o que o usuário pode ver | `/me/adoptions` só devolve as do usuário; `/organizations/:id/adoptions` só para membros daquela organização. |
| `ADOC-08` | Segurança · Concorrência           | Aprovação atômica                             | Se a gravação falha no meio, o pet não fica `ADOTADO` sem uma `Adoption` (transação).                         |

Voltar ao [índice dos testes](README.md).
