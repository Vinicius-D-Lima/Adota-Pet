# Prototipagem e refinamento

Como o produto evoluiu de um protótipo navegável até a versão atual, e o que cada rodada de refinamento corrigiu.

> **Nota sobre as fontes.** Este documento foi montado a partir do histórico real do repositório (PRs, issues e commits) e do [Plano de Projeto](plano-de-projeto.md). O **enunciado da atividade** que pede esta etapa não estava disponível ao escrever o documento. Se ele exigir um formato específico (por exemplo, telas desenhadas ou testes com usuários), esses itens precisam ser acrescentados pela equipe; o que não houve (testes de usabilidade com pessoas, protótipo em ferramenta de design) **não** está descrito aqui como se tivesse havido.

## 1. Prototipagem

### Protótipo funcional em código

A prototipagem foi feita **diretamente em código**, e não em uma ferramenta de design. O primeiro marco, anterior a 28/09/2026, foi um protótipo React com todo o fluxo de adoção (início → pets → detalhe → compatibilidade → questionário → confirmação → solicitações) usando dados locais, como pede o plano (seções 2.3 e 2.4).

| Tela                | Intenção do protótipo                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Início              | Apresentar a proposta de adoção responsável e levar ao catálogo ou perfil |
| Encontrar pets      | Busca e filtros sobre cartões com foto, distância e características       |
| Detalhe do pet      | Foto, história e necessidades (energia, espaço, crianças, outros pets)    |
| Compatibilidade     | Percentual, nível e o que combina ou pede conversa                        |
| Questionário        | Três perguntas abertas, uma de escolha e duas confirmações obrigatórias   |
| Confirmação         | Código da solicitação e próximos passos                                   |
| Minhas solicitações | Status e cancelamento                                                     |
| Perfil              | Dados que alimentam a compatibilidade                                     |

### Fluxo de quatro etapas

O componente `FlowSteps` mostra **Conhecer o pet → Compatibilidade → Questionário → Solicitação**, para que a pessoa saiba onde está. Esta decisão de fluxo veio do protótipo e foi mantida.

## 2. Rodadas de refinamento

Cada rodada saiu de uma issue, virou um PR pequeno sobre a `dev`, passou por revisão e pelo CI. Detalhes em [Histórico](historico.md).

| Rodada | Quando     | Problema observado                                                                        | Refinamento                                                                                       |
| ------ | ---------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1      | 28/09      | JavaScript sem tipos escondia divergências                                                | Migração para TypeScript `strict` (#10)                                                           |
| 2      | 03/10      | Sem verificação automática; formulários sem validação por campo                           | ESLint, Prettier, Vitest e CI (#66); TanStack Query e Zod (#68); validação por campo              |
| 3      | 03 a 04/10 | Dados locais não permitiam testar erros de servidor nem preparar o backend                | API simulada com json-server, perfil, favoritos e solicitações pela API (#69 a #74)               |
| 4      | 04/10      | Lista de solicitações presa em "Carregando…" no navegador, com testes passando            | Teste de contrato entre as respostas reais do mock e os schemas Zod                               |
| 5      | 04/10      | Mock descartava campos do perfil e aceitava parâmetros desconhecidos                      | Validação do perfil (`isComplete`, `missingFields`), 422 e 400 (#77)                              |
| 6      | 04/10      | "Enviada agora" fixo, JSX comentado, 404 do favicon                                       | Data real, limpeza e favicon (#75)                                                                |
| 7      | 04 a 05/10 | URL errada ou erro de render deixavam tela em branco ou redirecionavam sem aviso          | Página 404, Error Boundary, estados de "não encontrado" e lazy loading (#76)                      |
| 8      | 05/10      | A pessoa preenchia o questionário inteiro para só então receber o 409                     | Bloqueio proativo de duplicadas e confirmação antes de cancelar (#78), com 5 correções de revisão |
| 9      | 05/10      | Dados que existiam e não apareciam (vacinação, castração, tempo disponível)               | Selos de saúde, 7º critério da compatibilidade e atalho de preferências (#80)                     |
| 10     | 05/10      | Estilos e componentes repetidos em cada tela                                              | Biblioteca de componentes `src/components/ui` (#79)                                               |
| 11     | 05/10      | Documentação espalhada                                                                    | Pasta `docs/` (#83)                                                                               |
| 12     | 05/10      | CSS global de ~2.400 linhas, formulários com estado manual e poucos dados de demonstração | Tailwind CSS, react-hook-form e seed ampliado (esta entrega)                                      |

### Aprendizados do refinamento

- **Testar contra o servidor real, não só contra mocks de módulo:** o bug da rodada 4 só apareceu no navegador. Passou a existir o teste de contrato.
- **Avisar cedo vale mais do que tratar o erro tarde:** o bloqueio de duplicadas (rodada 8) nasceu de percorrer o fluxo como usuário.
- **Revisar o resultado da mescla, não só o PR:** o CI roda sobre a mescla com a `dev`, e alguns problemas só apareciam depois que outro PR entrava.
- **Teste novo precisa falhar sem a correção:** regra seguida nas rodadas 5 a 9.
- **A acessibilidade foi implementada, validada com axe e depois revertida:** o motivo do revert não está registrado no repositório; ver [Roadmap](roadmap.md#acessibilidade-57).

## 3. Refinamento da rodada 12 (Tailwind, react-hook-form e dados)

### O que mudou

- **Estilo:** toda a interface passou de CSS puro (`styles.css` e `ui.css`) para **Tailwind CSS 4**, com tokens de cor e fonte no `@theme` (`src/index.css`). Os componentes de `src/components/ui` continuam com as mesmas props, então as páginas quase não mudaram de API.
- **Formulários:** questionário e perfil usam **react-hook-form** com `zodResolver`, mantendo os mesmos schemas Zod. Erros do servidor (400) continuam apontando o campo, e 409 e 422 continuam com suas mensagens.
- **Dados de demonstração:** o seed passou de 6 para **12 pets** e de 1 para **4 solicitações**, uma por status (`Aprovada`, `Recusada`, `Cancelada` e `Em análise`).

### Como a equivalência visual foi conferida

As telas principais foram capturadas **antes e depois** com o Chromium do Playwright e comparadas lado a lado (início, listagem, detalhe, compatibilidade, questionário, solicitações, favoritos e perfil, em largura de desktop e de celular). As diferenças restantes são de poucos pixels, por arredondamento de espaçamentos. Os breakpoints antigos (720, 820 e 920 px) foram consolidados em `md` (768 px) e `lg` (1024 px) do Tailwind, que é a principal diferença perceptível ao redimensionar a janela.

### Pontos de atenção

- As fotos dos 6 pets novos usam URLs do Unsplash que **não puderam ser verificadas** no ambiente em que foram escritas (sem acesso à internet aberta). Se alguma não carregar, basta trocar o campo `image` e `gallery` no `mock-server/db.seed.json`.
- A escolha do **Tailwind** como "framework CSS de mercado" foi uma decisão de quem executou a tarefa, porque o pedido não indicava qual. Alternativas razoáveis: Bootstrap ou Chakra UI. Ver [Decisões](decisoes.md#16-tailwind-css-em-vez-de-css-puro).
