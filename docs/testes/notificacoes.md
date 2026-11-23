# Testes: Notificações

> Issue [#30](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/30) · prefixo `NOT` · **9 testes** (6 funcionais, 3 de segurança)

Garante criação, entrega por canal, preferências e isolamento das notificações de cada usuário. Todos os testes vivem em `apps/api/src/notifications.test.ts`, usam Vitest + supertest contra o Postgres de teste e limpam o banco entre casos (`test/reset.ts`).

## Como ler

O nome de cada teste começa com o ID entre colchetes, por exemplo `it('[NOT-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                     | O que verifica                                    | Como é testado                                                                                                     |
| -------- | ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `NOT-01` | Funcional                | Mudança de status notifica o adotante             | Transição em `/me/received-requests/:id/transitions` gera o evento; o handler cria a notificação com link interno. |
| `NOT-02` | Funcional                | Preferência desligada é respeitada                | `PUT /me/notification-preferences` desliga o tipo; handler não cria notificação nem enfileira e-mail.              |
| `NOT-03` | Segurança · BOLA/IDOR    | Só lê e marca como lidas as próprias notificações | Outro usuário vê lista vazia e recebe 404 ao tentar marcar a notificação alheia.                                   |
| `NOT-04` | Funcional                | `unreadCount` correto                             | Página de 5, contagem global, leitura individual, `read-all` e nova notificação.                                   |
| `NOT-05` | Funcional                | E-mail chega ao servidor SMTP                     | `SMTPServer` em processo captura a mensagem (o mesmo protocolo do Mailpit local).                                  |
| `NOT-06` | Funcional                | Falha no e-mail não bloqueia a notificação in-app | Enfileirador e transporte quebrados: notificação permanece, envio falha isoladamente.                              |
| `NOT-07` | Segurança · XSS          | Conteúdo em texto puro e link só interno          | Payload com `<script>` e link externo: título limpo e link substituído por rota do app.                            |
| `NOT-08` | Funcional                | Reprocessamento sem duplicar                      | Mesmo handler executado duas vezes: 1 notificação e 1 job de e-mail (`singletonKey`).                              |
| `NOT-09` | Segurança · Autenticação | Sem token retornam 401                            | Todas as cinco rotas `/me/notifications*` sem `Authorization`.                                                     |

## Executar

```bash
npm run test -w @adotapet/api -- --run src/notifications.test.ts
```

Sem `DATABASE_URL`, a suíte de banco é ignorada com aviso (padrão do repositório). Nenhum serviço externo é necessário: o SMTP de `NOT-05` roda no próprio processo.

Voltar ao [índice dos testes](README.md).
