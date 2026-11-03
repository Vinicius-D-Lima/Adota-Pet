# Testes: Notificações

> Issue [#30](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/30) · prefixo `NOT` · **9 testes** (6 funcionais, 3 de segurança, 0 de integração)

Garante criação, entrega por canal, preferências e isolamento das notificações de cada usuário.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[NOT-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                     | O que verifica                                    | Como é testado                                                                 |
| -------- | ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `NOT-01` | Funcional                | Mudança de status notifica o adotante             | Gera uma notificação in-app.                                                   |
| `NOT-02` | Funcional                | Preferência desligada é respeitada                | Não cria nem envia pelo canal desligado.                                       |
| `NOT-03` | Segurança · BOLA/IDOR    | Só lê e marca como lidas as próprias notificações | Outro usuário recebe 403 ou 404.                                               |
| `NOT-04` | Funcional                | `unreadCount` correto                             | Após marcar uma, marcar todas e chegar uma nova.                               |
| `NOT-05` | Funcional                | E-mails aparecem no Mailpit                       | Em desenvolvimento.                                                            |
| `NOT-06` | Funcional                | Falha no e-mail não bloqueia a notificação in-app | Com o servidor de e-mail parado.                                               |
| `NOT-07` | Segurança · XSS          | Conteúdo em texto puro e link só interno          | O `link` aceita apenas caminhos do próprio app. Evita redirecionamento aberto. |
| `NOT-08` | Funcional                | Reprocessamento sem duplicar                      | Uma falha transitória é repetida pelo pg-boss e a notificação não duplica.     |
| `NOT-09` | Segurança · Autenticação | Sem token retorna 401                             | Em todas as rotas.                                                             |

Voltar ao [índice dos testes](README.md).
