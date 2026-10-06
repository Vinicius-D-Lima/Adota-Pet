# Histórico

Linha do tempo do que foi feito, em ordem de mescla na `dev` (datas em UTC, de 22/09 a 05/10/2026).

## Resumo

| Marco                             | Quando         | O que mudou                                                                                                                  |
| --------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Protótipo em React                | antes de 28/09 | Fluxo completo com dados locais, sem API                                                                                     |
| TypeScript                        | 28/09          | Todo o frontend migrado de JavaScript                                                                                        |
| Qualidade e infraestrutura        | 03/10          | ESLint, Prettier, Vitest, CI, cliente de API, TanStack Query e Zod                                                           |
| API simulada e integração         | 03/10 a 04/10  | json-server, perfil, pets, solicitações e favoritos pela API                                                                 |
| Qualidade do frontend (épico #46) | 04/10 a 05/10  | Bugs, 404 e Error Boundary, bloqueio de duplicadas, selos de saúde, componentes                                              |
| Acessibilidade                    | 05/10          | Mesclada e revertida logo em seguida                                                                                         |
| Tailwind, react-hook-form e docs  | 05/10          | Estilos migrados para Tailwind, formulários com react-hook-form, seed ampliado e manuais (branch `refact/dependencies-docs`) |

## Pull requests

### Base do projeto

| PR  | Autoria  | Título                                               | Mesclado em |
| --- | -------- | ---------------------------------------------------- | ----------- |
| #1  | Vinicius | Fix/migrate-npm                                      | 22/09       |
| #10 | Vinicius | Migrar o frontend de JavaScript para TypeScript (#2) | 28/09       |
| #64 | Igor     | Ajusta o ícone do perfil com as iniciais do usuário  | 03/10       |
| #65 | Vinicius | merge dev                                            | 03/10       |

### Infraestrutura e integração com a API simulada

| PR  | Autoria  | Título                                                          | Issue | Mesclado em |
| --- | -------- | --------------------------------------------------------------- | ----- | ----------- |
| #66 | Vinicius | Adiciona lint, formatação, testes e CI                          | #52   | 03/10       |
| #67 | Vinicius | Adiciona cliente de API e configuração de ambiente              | #58   | 03/10       |
| #68 | Igor     | Adiciona TanStack Query, Zod e melhorias no perfil              | #8    | 03/10       |
| #69 | Vinicius | Adiciona API simulada com json-server                           | #63   | 03/10       |
| #72 | Igor     | `fix/consulta-api`: consulta de pets pela API                   | #59   | 03/10       |
| #71 | Vinicius | Persiste o perfil do adotante na API simulada                   | #32   | 03/10       |
| #74 | Vinicius | Persiste favoritos na API simulada e cria a página `/favoritos` | #62   | 04/10       |
| #73 | Vinicius | Integra solicitações de adoção com a API simulada               | #61   | 04/10       |

### Épico #46: qualidade e correções do frontend

| PR  | Título                                                                   | Issue | Mesclado em |
| --- | ------------------------------------------------------------------------ | ----- | ----------- |
| #77 | Valida o perfil completo e rejeita parâmetros desconhecidos em `/pets`   | #70   | 04/10       |
| #75 | Correções de bugs e limpeza (data real, JSX comentado, favicon)          | #53   | 04/10       |
| #76 | Error Boundary, página 404 e lazy loading                                | #56   | 04/10       |
| #78 | Bloqueio proativo de solicitação duplicada e confirmação de cancelamento | #55   | 05/10       |
| #80 | Selos de saúde, tempo disponível e preferências do perfil                | #54   | 05/10       |
| #81 | Acessibilidade: teclado, foco, leitores de tela, movimento e contraste   | #57   | 05/10       |
| #82 | **Revert** do #81                                                        | -     | 05/10       |
| #79 | Extrai componentes reutilizáveis para `src/components/ui`                | #6    | 05/10       |

> **Autoria:** "Vinicius" e "Igor" são as duas pessoas que contribuíram. Vários PRs foram preparados com apoio do Claude Code.

### Branch `refact/dependencies-docs` (em PR para a `dev`)

Migração dos estilos de CSS puro para **Tailwind CSS 4**, dos formulários para **react-hook-form**, seed com 12 pets e 4 solicitações, e os manuais de instalação, operação e do usuário, o plano de projeto, o comparativo "prometido x entregue" e o documento de prototipagem. Ver [Decisões 16 a 18](decisoes.md#16-tailwind-css-em-vez-de-css-puro).

## O que cada etapa entregou

### Qualidade e infraestrutura (#66, #67, #68)

- ESLint 9, Prettier, Vitest com Testing Library e **CI** (lint, formatação, tipos, testes e build).
- Cliente HTTP tipado (`api`), `ApiError` e variável `VITE_API_URL`.
- TanStack Query e Zod, e melhorias no perfil e nos formulários: validação com erros por campo e iniciais do nome sem as partículas "de", "da" e semelhantes.

### API simulada (#69, #72, #71, #74, #73)

- json-server com seed, persistência em `db.json`, latência configurável e proxy do Vite.
- Pets (listagem, filtros, ordenação e paginação), perfil, favoritos e solicitações pela API, cada um com seus testes.
- Nesta fase foram removidos os dados locais (`localApi.ts`, `data/pets.ts` e `data/appData.ts`) e o estado global do `App`.
- Resolver os conflitos entre esses PRs revelou um bug que só aparecia no navegador (a lista de solicitações presa em "Carregando…"), que levou ao **teste de contrato**.

### Ajuste do mock (#77)

O mock descartava `cpf`, `birthDate`, `email`, `phone`, `zipCode` e `address` ao salvar o perfil. Agora valida e persiste esses campos, devolve `isComplete` e `missingFields`, responde 422 no envio com perfil incompleto e rejeita parâmetros desconhecidos em `/pets` com 400.

### Correções e limpeza (#75)

Data real na tela de confirmação (em vez de "Enviada agora"), remoção de JSX comentado na página inicial e favicon (que causava 404 em toda página).

### Erros, 404 e performance (#76)

`ErrorBoundary`, página 404, estados de "não encontrado", páginas com `React.lazy`, imagens com `loading="lazy"` e dimensões. Bundle inicial de ~384 kB para ~330 kB.

### Solicitação duplicada e cancelamento (#78)

Aviso antes do questionário, redirecionamento seguro, `ConfirmDialog` acessível e tratamento do foco. A revisão de código deste PR gerou cinco correções: o modal não some quando um refetch falha, o erro antigo é limpo ao reabrir, o texto do aviso é legível (14 px), o redirecionamento não perde respostas e o fundo fica inerte com a rolagem travada.

### Dados que já existiam (#80)

Selos de vacinação e castração, sétimo critério da compatibilidade (tempo disponível), restauração do teste do "primeiro pet" (que havia sumido da suíte), filtro de porte com vários valores e o atalho "Usar minhas preferências".

### Componentização (#79)

Biblioteca de componentes `Button`, `LinkButton`, `Field`/`Input`/`Select`/`Textarea`, `Checkbox`, `Card`, `Badge`, `StatusPill`, `Alert`, `EmptyState`, `Spinner` e `PageIntro`, aplicada em todas as páginas. Ao ser mesclado por último, o PR absorveu o código novo dos demais (modal, 404, selos) e converteu-o para os componentes.

## O revert da acessibilidade (#81 e #82)

O PR #81 implementou, e o #82 **desfez**, o trabalho de acessibilidade (#57). Ele **não está na `dev`**, e a issue #57 está fechada. O que o #81 continha:

- **Menu mobile:** `aria-expanded`, `aria-controls`, rótulo "Abrir menu" ou "Fechar menu", fecha com Esc e com clique fora.
- **Link "Pular para o conteúdo"** que leva o foco ao `<main>`.
- **Foco visível** global (`:focus-visible`) e contorno na caixa de busca.
- **`prefers-reduced-motion`:** desliga animações, transições e rolagem suave.
- **Busca** com `aria-label`, e `role="status"` na confirmação do perfil, na contagem de resultados e no esqueleto de carregamento.
- **Estrutura de títulos:** `PetCard` com nível configurável (`h2` nas páginas com `h1`).
- **Contraste AA:** botão primário e textos em coral mais escuros, texto secundário mais escuro; a auditoria no navegador foi de 28 violações para 0.
- **Testes:** `axe-core` nas páginas principais e testes dos tokens de contraste.

Como retomar: veja [Roadmap → Acessibilidade](roadmap.md#acessibilidade-57).

## Issues

### Concluídas

| Issue | Título                                                                            |
| ----- | --------------------------------------------------------------------------------- |
| #2    | Migrar o projeto para TypeScript                                                  |
| #6    | Componentizar o frontend e criar biblioteca de componentes reutilizáveis          |
| #8    | Adicionar TanStack Query e Zod ao projeto                                         |
| #32   | Perfil do adotante persistido na API simulada                                     |
| #52   | Setup de qualidade: ESLint, Prettier, testes (Vitest) e CI                        |
| #53   | Correções de bugs e limpeza do protótipo                                          |
| #54   | Exibir e usar dados que já existem (saúde do pet, tempo disponível, preferências) |
| #55   | Bloqueio proativo de solicitação duplicada e confirmação de cancelamento          |
| #56   | Error Boundary, página 404 e performance (lazy loading)                           |
| #57   | Acessibilidade (fechada, mas o PR foi revertido; ver acima)                       |
| #58   | Cliente de API e configuração de ambiente                                         |
| #59   | Pets vindos da API simulada: listagem, filtros, ordenação e detalhe               |
| #61   | Solicitações de adoção via API simulada                                           |
| #62   | Favoritos via API simulada e página `/favoritos`                                  |
| #63   | API simulada com json-server                                                      |
| #70   | Ajustar o mock (perfil, `isComplete`/`missingFields` e parâmetros de `/pets`)     |

### Encerrada sem implementação

- **#7:** migração condicional para Next.js (**não planejada**).

### Épicos

O projeto está organizado em épicos com issues de frontend e de backend separadas: matching (#11), processo de aprovação em etapas (#12), acompanhamento pós-adoção (#13), avaliações, reputação e denúncias (#14), organizações (#15), prontuário médico (#16), notificações (#17), núcleo da API (#45) e qualidade do frontend (#46). Os épicos #45 e #11 a #17 seguem abertos (fase do backend). O #46 tem todas as sub-issues concluídas.
