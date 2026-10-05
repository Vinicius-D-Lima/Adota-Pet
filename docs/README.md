# Documentação do AdotaPet

Esta pasta reúne tudo o que foi feito no frontend do AdotaPet até aqui: o que o produto faz, como o código está organizado, como a API simulada se comporta, as decisões tomadas e o que falta.

> **Estado em 05/10/2026.** O trabalho está na branch `dev` (commit `c6ce19a`). A entrega atual é **somente o frontend**, consumindo uma API simulada com json-server. Não há backend, autenticação nem banco de dados reais.

## Índice

| Documento                                   | Para que serve                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| [Visão geral](visao-geral.md)               | O produto, o escopo entregue, o que ficou fora e como rodar                      |
| [Funcionalidades](funcionalidades.md)       | Cada tela e cada regra de negócio, em detalhe                                    |
| [Arquitetura](arquitetura.md)               | Stack, estrutura de pastas, fluxo de dados, rotas, cache e tratamento de erros   |
| [API simulada](api-simulada.md)             | Contrato do json-server, regras de validação, erros e dados de exemplo           |
| [Componentes de UI](componentes-ui.md)      | A biblioteca de componentes em `src/components/ui` e os componentes de aplicação |
| [Qualidade, testes e CI](qualidade-e-ci.md) | Scripts, ESLint, Prettier, testes, workflow de CI e fluxo de branches e PRs      |
| [Decisões técnicas](decisoes.md)            | Por que as coisas foram feitas do jeito que foram                                |
| [Histórico](historico.md)                   | Linha do tempo de PRs e issues, inclusive o revert da acessibilidade             |
| [Roadmap e pendências](roadmap.md)          | O que ainda falta, limitações conhecidas e a fase do backend                     |

## Comece por aqui

- **Quero rodar o projeto:** [Visão geral → Como executar](visao-geral.md#como-executar).
- **Quero entender uma regra de negócio** (compatibilidade, solicitação duplicada, cancelamento): [Funcionalidades](funcionalidades.md).
- **Vou mexer no código:** [Arquitetura](arquitetura.md) e [Qualidade, testes e CI](qualidade-e-ci.md).
- **Vou integrar um backend real:** [API simulada](api-simulada.md) e [Roadmap](roadmap.md#fase-2-backend).
