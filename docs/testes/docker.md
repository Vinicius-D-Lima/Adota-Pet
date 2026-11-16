# Testes: Docker do projeto inteiro (Hadolint + Trivy)

> Issue [#96](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/96) · prefixo `DOCK` · **10 testes** (0 funcionais, 7 de segurança, 3 de integração)

Garante que web, api, banco, storage e e-mail sobem em contêineres, com Dockerfiles revisados e imagens sem vulnerabilidades corrigíveis.

## Como ler

Cada linha da tabela é uma verificação executada no CI ou na infraestrutura, e não um teste de unidade. O ID (por exemplo `DOCK-01`) aparece no nome do passo do workflow ou do script que a executa, para que este documento, a issue e a automação se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo                              | O que verifica                                         | Como é testado                                                                                  |
| --------- | --------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `DOCK-01` | Integração                        | `docker compose up` sobe tudo saudável                 | web, api, db, storage e mailpit com healthcheck `healthy`.                                      |
| `DOCK-02` | Segurança · Cadeia de suprimentos | Hadolint sem erros                                     | Os Dockerfiles passam no Hadolint; o CI falha em qualquer erro.                                 |
| `DOCK-03` | Segurança · Cadeia de suprimentos | Trivy de imagem: HIGH e CRITICAL com correção reprovam | O CI falha se a imagem tiver vulnerabilidade HIGH ou CRITICAL que já tenha versão corrigida.    |
| `DOCK-04` | Segurança · Configuração          | Trivy de configuração sem HIGH ou CRITICAL             | Verifica Dockerfiles e compose.                                                                 |
| `DOCK-05` | Segurança · Configuração          | Contêineres rodam sem root                             | Confere `USER` não-root em cada imagem.                                                         |
| `DOCK-06` | Segurança · Segredos              | Imagem de produção enxuta e sem segredos               | Multi-stage, sem devDependencies, sem `.env`, sem código de teste; o Gitleaks varre as camadas. |
| `DOCK-07` | Segurança · Cadeia de suprimentos | Imagens base com versão fixa                           | Tag com digest, nunca `latest`.                                                                 |
| `DOCK-08` | Integração                        | `.dockerignore` presente                               | Exclui `node_modules`, `.git` e `.env`.                                                         |
| `DOCK-09` | Segurança · Configuração          | Portas do banco e do storage só em localhost           | No compose padrão, publicadas em `127.0.0.1`.                                                   |
| `DOCK-10` | Integração                        | Build de produção da api e do web no CI                | Com cache de camadas.                                                                           |

Voltar ao [índice dos testes](README.md).
