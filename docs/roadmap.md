# Roadmap e pendências

O que ainda falta, o que sabemos que é limitado e como seguir para a fase do backend.

## Resumo

| Item                                     | Situação                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Acessibilidade (#57)                     | **Revertida.** Falta decidir se volta e refazer o PR sobre a `dev` |
| Recomendações "Para você" (#33)          | Aberta; precisa de adaptação para a entrega só com frontend        |
| Área da organização (#60 e relacionadas) | Depende de backend e autenticação                                  |
| Fase do backend                          | Não iniciada                                                       |
| Publicação                               | Sem deploy; o mock precisa de hospedagem à parte                   |

## Acessibilidade (#57)

O trabalho existe e foi validado, mas foi desfeito pelo PR #82 e **não está na `dev`**. A issue #57 está fechada. Duas saídas:

1. **O revert foi proposital:** nada a fazer. Se a issue deve refletir isso, reabra-a ou feche-a como não planejada.
2. **O revert foi por engano ou provisório:** abrir um PR novo a partir da `dev`, reaproveitando o que o #81 trazia (lista em [Histórico](historico.md#o-revert-da-acessibilidade-81-e-82)) e adaptando aos componentes de `src/components/ui`. Atenção a dois pontos descobertos na validação do #81:
   - o teste do `axe` precisa usar um pet **sem** solicitação ativa no questionário (senão a página redireciona) e esperar o conteúdo real, não só o título;
   - o esqueleto de carregamento com `aria-label` precisa de `role="status"`.

Critérios de aceite da issue, para conferência: fluxo completo só com teclado e foco sempre visível; menu mobile que abre e fecha pelo teclado e anuncia o estado; sem animações com "reduzir movimento"; axe sem violações críticas ou sérias; contraste AA em todas as combinações.

## Pendências em relação ao Plano de Projeto

A lista completa está em [Escopo prometido x entregue](escopo-prometido-vs-entregue.md#5-pendências-em-relação-ao-plano). Em resumo: acessibilidade completa, decisão sobre o cancelamento de `Aprovada` (REQ-18), registro do teste de aceite e da demonstração, lições aprendidas e versão 1.1 do plano.

## Frontend ainda possível com o mock

- **#33, Recomendações "Para você":** a issue prevê recomendações e compatibilidade vindas da API. Sem backend, pode ser adaptada para usar a compatibilidade já calculada no cliente (`calculateCompatibility`) sobre a lista de pets, ou para uma rota nova no mock (por exemplo `GET /me/matches`).
- **Cobertura de testes:** a página inicial e a página de detalhe têm menos testes do que as demais.
- **Validação do perfil na leitura:** `useAdopterProfile` converte a resposta à mão (`toAdopterProfile`); poderia passar por um schema Zod como os outros hooks.

## Limitações conhecidas

- **Usuário único e sem autenticação:** tudo fala do usuário `demo`.
- **Estados da solicitação:** a instituição já pode iniciar a análise, aprovar e recusar (PR #86), mas sem etapas de entrevista e visita, sem motivo obrigatório da recusa e sem diferença entre administrador e voluntário.
- **Distância:** calculada a partir de coordenadas fixas, sem geolocalização do navegador.
- **Imagens:** os pets usam URLs externas; não há upload.
- **Compatibilidade:** calculada no cliente, com critérios de peso igual e sem ajuste de pesos.
- **Hospedagem:** o json-server não roda em hospedagem estática (ver [Visão geral](visao-geral.md#publicar-o-frontend)).
- **Módulos fora do escopo:** chat, etapas da solicitação, pós-adoção, avaliações, denúncias, notificações e prontuário.

## Fase 2: backend

### Decisões da fase

Registradas em [Decisões técnicas](decisoes.md#19-backend-em-express-não-em-nestjs): **Express**, **PostgreSQL** com **Prisma** e migrations, **JWT** curto com refresh rotacionado em cookie httpOnly, **CASL**, arquivos pela **API do S3** com **SeaweedFS**, jobs com **pg-boss**, **monorepo** com npm workspaces, testes com **Vitest e supertest** e **Docker** para o projeto inteiro com Hadolint e Trivy. O [catálogo de testes](testes/README.md) tem 238 testes (112 de segurança), cada um com ID.

> Os documentos de gerência ainda citam MongoDB. Essa divergência está registrada na decisão 20, e a atualização deles cabe à equipe de gerência.

### Ordem das issues

A ordem respeita as dependências declaradas em cada issue. Issues da mesma linha podem andar em paralelo.

| Ordem | Épico | Issues                                       | Tema                                                                                     |
| ----- | ----- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | #93   | #3                                           | Monorepo com npm workspaces                                                              |
| 2     | #93   | #9 e #97                                     | Banco PostgreSQL no Docker; pipeline de segurança no CI (já pode começar)                |
| 3     | #93   | #96                                          | Docker do projeto inteiro (web, mock e banco agora; a API depois da #47)                 |
| 4     | #45   | #47, #94 e #95                               | Padrões da API (Express e Prisma), armazenamento S3 (SeaweedFS) e fila de jobs (pg-boss) |
| 5     | #45   | #48, #4 e #5                                 | Autenticação no backend, no frontend e proteção de rotas                                 |
| 6     | #15   | #27, #28 e #41                               | Organizações, permissões (CASL) e área da organização                                    |
| 7     | #11   | #18                                          | Perfil do adotante na API                                                                |
| 8     | #45   | #49, #51, #50 e #60                          | Pets, favoritos e solicitações na API; cadastro de pets na área da organização           |
| 9     | #11   | #19 e #33                                    | Serviço de matching e recomendações "Para você"                                          |
| 10    | #12   | #20, depois #21 e #22, depois #34, #35 e #36 | Máquina de estados, agendamento, chat e as telas do adotante e do responsável            |
| 11    | #16   | #29 e #42                                    | Prontuário médico do pet                                                                 |
| 12    | #17   | #30, depois #31, depois #43 e #44            | Notificações, filtros salvos e alertas                                                   |
| 13    | #13   | #23, depois #24, depois #37 e #38            | Adoção e acompanhamento pós-adoção                                                       |
| 14    | #14   | #25, depois #26, depois #39 e #40            | Avaliações, reputação, denúncias e moderação                                             |
| 15    | #93   | #98                                          | Testes de segurança dinâmicos noturnos (quando a API tiver a OpenAPI estável)            |

### Como trocar o mock pelo backend

O frontend só conhece a URL base e o contrato.

1. Aponte `VITE_API_URL` para o backend (ou ajuste o proxy do Vite).
2. Mantenha as rotas e os formatos descritos em [API simulada](api-simulada.md): `{ data, total }` nas listas, solicitação com o pet embutido, datas em ISO, e erros no formato `{ statusCode, error, message, details }` com os códigos 400, 404, 409 e 422 com o mesmo significado.
3. Rode `mock-server/contract.test.js` como referência: ele mostra exatamente o que o frontend valida.
4. Troque o usuário fixo pela sessão autenticada (#48, #4 e #5), e as rotas `/me/*` passam a depender do token.
5. A tela de compatibilidade passa a consumir o resultado do serviço de matching (#19), se ele for entregue.

## Próximos passos recomendados

1. Decidir sobre a acessibilidade (#57) e, se for o caso, refazer o PR.
2. Validar a `dev` completa (`npm ci`, lint, formatação, tipos, testes, build e um teste no navegador com o mock).
3. Manter a `main` em dia com a `dev` por PR, para a `main` receber o que já foi validado.
4. Limpar as branches já mescladas.
5. Iniciar a fase do backend pela #3 (monorepo) e, em paralelo, pela #97 (pipeline de segurança), que já vale para o mock e o frontend.
