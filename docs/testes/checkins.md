# Testes: Check-ins pós-adoção com fotos

> Issue [#24](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/24) · prefixo `CHK` · **10 testes** (3 funcionais, 7 de segurança, 0 de integração)

Garante upload seguro de fotos, acesso restrito às partes e controle correto de prazos e estados.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[CHK-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                                  | Como é testado                                                                                            |
| -------- | ---------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `CHK-01` | Segurança · Upload                 | Só imagens jpeg, png e webp                     | Qualquer outro tipo retorna 400.                                                                          |
| `CHK-02` | Segurança · Upload                 | Tipo validado pelo conteúdo                     | Um arquivo com assinatura de executável e extensão `.jpg` é rejeitado. Evita upload malicioso disfarçado. |
| `CHK-03` | Segurança · Upload                 | Limites de 5 MB por foto e 5 fotos por check-in | Acima de qualquer limite retorna 400.                                                                     |
| `CHK-04` | Segurança · Autorização por função | Só o adotante envia e só membros revisam        | Outros usuários recebem 403.                                                                              |
| `CHK-05` | Segurança · BOLA/IDOR              | Fotos acessíveis só pelas partes                | O bucket é privado; sem URL assinada válida o acesso retorna 403.                                         |
| `CHK-06` | Segurança · Upload                 | Nome do objeto gerado pelo servidor             | Um nome de arquivo `../../etc/passwd` não escapa do diretório (sem path traversal).                       |
| `CHK-07` | Funcional                          | Vencido sem envio vira `ATRASADO`               | Verificado pelo job agendado do pg-boss, com relógio simulado.                                            |
| `CHK-08` | Funcional                          | Transições de status do check-in                | `PENDENTE`, `ENVIADO`, `REVISADO`; "pedir mais informações" volta a `PENDENTE`.                           |
| `CHK-09` | Funcional                          | Eventos emitidos                                | `CheckInDue`, `CheckInOverdue` e `CheckInReviewed` são enfileirados.                                      |
| `CHK-10` | Segurança · BOLA/IDOR              | URL assinada expirada retorna 403               | Com relógio simulado após o prazo.                                                                        |

Voltar ao [índice dos testes](README.md).
