# Testes: Usuários e autenticação

> Issue [#48](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/48) · prefixo `AUTH` · **16 testes** (5 funcionais, 11 de segurança, 0 de integração)

Garante cadastro, login, refresh rotacionado em cookie httpOnly e proteção contra os ataques clássicos de autenticação.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[AUTH-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo                           | O que verifica                                          | Como é testado                                                                                                                          |
| --------- | ------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH-01` | Funcional                      | Cadastro normaliza o e-mail                             | Cadastra `Ana@Exemplo.COM` e confere que fica `ana@exemplo.com`.                                                                        |
| `AUTH-02` | Funcional                      | E-mail repetido retorna 409                             | Inclusive com caixa diferente.                                                                                                          |
| `AUTH-03` | Funcional                      | Senha curta ou e-mail inválido retorna 400              | No formato padrão de erro, com `details` por campo.                                                                                     |
| `AUTH-04` | Segurança · Exposição de dados | Senha com argon2 e `passwordHash` nunca exposto         | O hash começa com `$argon2id$` e difere da senha; nenhuma resposta (cadastro, login, `/me`, erros) contém `passwordHash`.               |
| `AUTH-05` | Segurança · Autenticação       | Login não revela se o e-mail existe                     | Senha errada e e-mail inexistente devolvem o mesmo status, a mesma mensagem e tempo de resposta semelhante. Evita enumeração de contas. |
| `AUTH-06` | Segurança · Limite de uso      | 6ª tentativa de login em 1 minuto retorna 429           | Por IP + e-mail. Evita força bruta.                                                                                                     |
| `AUTH-07` | Funcional                      | Login emite access token curto e cookie de refresh      | O access token expira em cerca de 15 minutos; o refresh vem em cookie.                                                                  |
| `AUTH-08` | Segurança · Autenticação       | Cookie de refresh com flags de segurança                | Confere `HttpOnly`, `Secure` (fora do desenvolvimento) e `SameSite`; o access token nunca é gravado em cookie.                          |
| `AUTH-09` | Segurança · Autenticação       | JWT adulterado é rejeitado                              | Troca um caractere da assinatura e espera 401.                                                                                          |
| `AUTH-10` | Segurança · Autenticação       | JWT com `alg: none` ou algoritmo inesperado é rejeitado | Monta um token sem assinatura e outro com HS256 quando o esperado é outro algoritmo; ambos retornam 401.                                |
| `AUTH-11` | Segurança · Autenticação       | JWT expirado é rejeitado                                | Com relógio simulado, espera 401 depois do prazo.                                                                                       |
| `AUTH-12` | Segurança · Autenticação       | Refresh rotacionado e reuso detectado                   | Usar o refresh antigo depois da rotação é rejeitado e revoga a cadeia inteira de tokens do usuário.                                     |
| `AUTH-13` | Segurança · Autenticação       | Logout invalida o refresh                               | Depois do logout o refresh não funciona mais.                                                                                           |
| `AUTH-14` | Segurança · Mass assignment    | Cadastro ignora campos privilegiados                    | Enviar `platformRole: "MODERADOR"` ou `id` no corpo não altera o papel nem o id do novo usuário.                                        |
| `AUTH-15` | Funcional                      | Rota protegida exige token                              | Sem token retorna 401; com token válido, `GET /me` devolve o usuário.                                                                   |
| `AUTH-16` | Segurança · Exposição de dados | Refresh token guardado só como hash                     | Consulta o banco e confere que não há token em texto puro.                                                                              |

Voltar ao [índice dos testes](README.md).
