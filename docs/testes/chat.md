# Testes: Chat da solicitação

> Issue [#22](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/22) · prefixo `CHAT` · **9 testes** (4 funcionais, 5 de segurança, 0 de integração)

Garante que só as partes conversam, que o conteúdo é seguro e que o chat fecha quando a solicitação termina.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[CHAT-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo                           | O que verifica                                          | Como é testado                                                                         |
| --------- | ------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `CHAT-01` | Segurança · BOLA/IDOR          | Só participantes leem e enviam                          | Outros usuários recebem 403 em `GET` e `POST`.                                         |
| `CHAT-02` | Funcional                      | Mensagem vazia ou acima de 2.000 caracteres retorna 400 | Nos dois limites.                                                                      |
| `CHAT-03` | Funcional                      | Paginação por cursor                                    | Histórico ordenado por data, sem repetir mensagens.                                    |
| `CHAT-04` | Funcional                      | Estado final deixa o chat somente leitura               | Enviar mensagem retorna 409.                                                           |
| `CHAT-05` | Funcional                      | Contagem de não lidas                                   | Disponível por solicitação e atualizada ao marcar como lidas.                          |
| `CHAT-06` | Segurança · XSS                | HTML e script são texto puro                            | Uma mensagem com `<script>` é guardada e devolvida literalmente. Evita XSS armazenado. |
| `CHAT-07` | Segurança · Exposição de dados | Contatos das partes não vazam                           | Nenhuma resposta do chat traz telefone ou e-mail do outro lado.                        |
| `CHAT-08` | Segurança · Limite de uso      | Envio em excesso retorna 429                            | Evita flood de mensagens.                                                              |
| `CHAT-09` | Segurança · BOLA/IDOR          | Marcar como lido só na própria conversa                 | `PATCH .../read` de uma solicitação alheia retorna 403.                                |

Voltar ao [índice dos testes](README.md).
