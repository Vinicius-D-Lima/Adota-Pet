# Documentação do AdotaPet

Esta pasta reúne o que o AdotaPet faz, como o monorepo está organizado, como a API simulada se comporta, as decisões técnicas e o que falta.

> **Estado atual:** o repositório é um monorepo **npm workspaces** com `@adotapet/web` (`apps/web`), `@adotapet/api` (`apps/api`) e `@adotapet/shared` (`packages/shared`). Alguns documentos históricos citam caminhos anteriores ao movimento; onde houver divergência, prevalecem [Arquitetura](arquitetura.md) e o [README da raiz](../README.md). Há backend real (Express + Prisma/PostgreSQL) e API simulada, mas ainda não há autenticação JWT.

## Índice

| Documento                                                      | Para que serve                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Visão geral](visao-geral.md)                                  | O produto, o escopo entregue, o que ficou fora e como rodar                               |
| [Funcionalidades](funcionalidades.md)                          | Cada tela e cada regra de negócio, em detalhe                                             |
| [Arquitetura](arquitetura.md)                                  | Stack, estrutura de pastas, fluxo de dados, rotas, cache e tratamento de erros            |
| [API simulada](api-simulada.md)                                | Contrato do json-server, regras de validação, erros e dados de exemplo                    |
| [Componentes de UI](componentes-ui.md)                         | A biblioteca de componentes em `apps/web/src/components/ui` e os componentes de aplicação |
| [Qualidade, testes e CI](qualidade-e-ci.md)                    | Scripts, ESLint, Prettier, testes, workflow de CI e fluxo de branches e PRs               |
| [Testes do monorepo](testes/monorepo.md)                       | Verificações `MONO-01` a `MONO-06` e onde cada uma roda no CI                             |
| [Decisões técnicas](decisoes.md)                               | Por que as coisas foram feitas do jeito que foram                                         |
| [Histórico](historico.md)                                      | Linha do tempo de PRs e issues, inclusive o revert da acessibilidade                      |
| [Roadmap e pendências](roadmap.md)                             | O que ainda falta, limitações conhecidas e a fase do backend                              |
| [Testes do backend](testes/README.md)                          | Catálogo de 238 testes com ID, explicação de cada um e matriz de segurança                |
| [Manual de instalação](manual-de-instalacao.md)                | Pré-requisitos, instalação, execução, build, publicação e problemas comuns                |
| [Manual de operação](manual-de-operacao.md)                    | Rotina, dados do mock, configuração, fluxo de PRs e resolução de problemas                |
| [Manual do usuário](manual-do-usuario.md)                      | Passo a passo do fluxo de adoção, do perfil ao cancelamento                               |
| [Plano de Projeto](plano-de-projeto.md)                        | O plano da equipe (v1.0), como entregue                                                   |
| [Escopo prometido x entregue](escopo-prometido-vs-entregue.md) | Requisitos do plano x o que existe, com as divergências justificadas                      |
| [Prototipagem e refinamento](prototipagem-e-refinamento.md)    | Do protótipo à versão atual, rodada por rodada                                            |

## Comece por aqui

- **Quero rodar o projeto:** [Manual de instalação](manual-de-instalacao.md) (ou [Visão geral → Como executar](visao-geral.md#como-executar)).
- **Quero usar o sistema:** [Manual do usuário](manual-do-usuario.md).
- **Quero comparar com o plano:** [Escopo prometido x entregue](escopo-prometido-vs-entregue.md).
- **Quero entender uma regra de negócio** (compatibilidade, solicitação duplicada, cancelamento): [Funcionalidades](funcionalidades.md).
- **Vou mexer no código:** [Arquitetura](arquitetura.md) e [Qualidade, testes e CI](qualidade-e-ci.md).
- **Vou integrar um backend real:** [API simulada](api-simulada.md) e [Roadmap](roadmap.md#fase-2-backend).
