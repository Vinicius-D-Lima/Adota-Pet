# Testes: Banco PostgreSQL em Docker

> Issue [#9](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/9) · prefixo `DB` · **7 testes** (0 funcionais, 2 de segurança, 5 de integração)

Garante que o banco sobe com um comando, persiste dados, aplica migrations e seed de forma repetível e sem credenciais no repositório.

## Como ler

Cada linha da tabela é uma verificação executada no CI ou na infraestrutura, e não um teste de unidade. O ID (por exemplo `DB-01`) aparece no nome do passo do workflow ou do script que a executa, para que este documento, a issue e a automação se encontrem pelo mesmo identificador.

## Testes

| ID      | Tipo                     | O que verifica                                       | Como é testado                                                                                                                                     |
| ------- | ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB-01` | Integração               | O banco sobe com `docker compose up` e fica saudável | O healthcheck do serviço `db` passa a `healthy` em até 30 segundos.                                                                                |
| `DB-02` | Integração               | Os dados sobrevivem a `docker compose down`          | Grava um registro, derruba os contêineres sem `-v`, sobe de novo e confere que o registro continua lá.                                             |
| `DB-03` | Segurança · Segredos     | Credenciais só por variável de ambiente              | O compose falha se `POSTGRES_PASSWORD` não estiver definida, e o Gitleaks não encontra senha no repositório. Evita credenciais padrão em produção. |
| `DB-04` | Segurança · Configuração | A porta do banco não fica exposta para a rede        | A porta é publicada apenas em `127.0.0.1`. Evita banco acessível de fora da máquina.                                                               |
| `DB-05` | Integração               | `prisma migrate deploy` em banco vazio               | Aplica todas as migrations, na ordem, sem erro.                                                                                                    |
| `DB-06` | Integração               | O seed é idempotente                                 | Rodar o seed duas vezes não duplica registros nem falha.                                                                                           |
| `DB-07` | Integração               | Reset completo devolve o estado inicial              | `down -v`, `up`, migrate e seed resultam nos mesmos dados de exemplo.                                                                              |

Voltar ao [índice dos testes](README.md).
