# Testes: Pipeline de segurança no CI

> Issue [#97](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/97) · prefixo `SEC` · **9 testes** (0 funcionais, 9 de segurança, 0 de integração)

Garante que dependências, segredos, código e o próprio pipeline sejam verificados automaticamente em todo PR.

## Como ler

Cada linha da tabela é uma verificação executada no CI ou na infraestrutura, e não um teste de unidade. O ID (por exemplo `SEC-01`) aparece no nome do passo do workflow ou do script que a executa, para que este documento, a issue e a automação se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                              | O que verifica                           | Como é testado                                                   |
| -------- | --------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `SEC-01` | Segurança · Cadeia de suprimentos | Dependabot ativo                         | Abre PRs para npm, docker e github-actions.                      |
| `SEC-02` | Segurança · Cadeia de suprimentos | `npm audit` reprova vulnerabilidade alta | `npm audit --omit=dev --audit-level=high` falha o CI.            |
| `SEC-03` | Segurança · Segredos              | Gitleaks reprova segredo                 | Um PR de teste com uma chave falsa conhecida é bloqueado.        |
| `SEC-04` | Segurança · Cadeia de suprimentos | CodeQL em PR e semanal                   | Linguagem javascript-typescript, com resultados na aba Security. |
| `SEC-05` | Segurança · Configuração          | Workflow com permissões mínimas          | `permissions: contents: read` no topo do workflow.               |
| `SEC-06` | Segurança · Cadeia de suprimentos | Actions fixadas por SHA                  | Nenhuma action por tag móvel.                                    |
| `SEC-07` | Segurança · Configuração          | Branches protegidas                      | `main` e `dev` exigem CI verde e revisão.                        |
| `SEC-08` | Segurança · Segredos              | Secret scanning e push protection ativos | Configuração do repositório verificada.                          |
| `SEC-09` | Segurança · Cadeia de suprimentos | `npm ci --ignore-scripts` onde possível  | Evita execução de scripts de instalação de dependências.         |

Voltar ao [índice dos testes](README.md).
