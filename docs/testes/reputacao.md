# Testes: Avaliações e reputação

> Issue [#25](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/25) · prefixo `REV` · **9 testes** (6 funcionais, 3 de segurança, 0 de integração)

Garante elegibilidade, unicidade, janela de edição e cálculo correto da reputação, sem permitir avaliar em nome de outro.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[REV-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                           | Como é testado                                                                     |
| -------- | ---------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `REV-01` | Segurança · Autorização por função | Quem não participou da adoção não avalia | Retorna 403.                                                                       |
| `REV-02` | Funcional                          | Uma avaliação por lado e por adoção      | A segunda do mesmo lado retorna 409.                                               |
| `REV-03` | Funcional                          | Nota e comentário validados              | Nota fora de 1 a 5 ou comentário com mais de 1.000 caracteres retorna 400.         |
| `REV-04` | Funcional                          | Média e contagem corretas                | Ignoram avaliações ocultadas.                                                      |
| `REV-05` | Funcional                          | Média só a partir de 3 avaliações        | Antes disso a média não é exposta.                                                 |
| `REV-06` | Funcional                          | Liberada 7 dias depois da adoção         | Antes disso retorna 403 ou 409; no sétimo dia, aceita (relógio simulado).          |
| `REV-07` | Funcional                          | Edição só até 7 dias                     | Depois da janela a edição é recusada.                                              |
| `REV-08` | Segurança · XSS                    | Comentário tratado como texto puro       | Um `<script>` é guardado e devolvido literalmente.                                 |
| `REV-09` | Segurança · Mass assignment        | `reviewerId` do corpo é ignorado         | O avaliador é sempre o usuário autenticado. Evita avaliar em nome de outra pessoa. |

Voltar ao [índice dos testes](README.md).
