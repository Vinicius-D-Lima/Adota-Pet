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

## Frontend ainda possível com o mock

- **#33, Recomendações "Para você":** a issue prevê recomendações e compatibilidade vindas da API. Sem backend, pode ser adaptada para usar a compatibilidade já calculada no cliente (`calculateCompatibility`) sobre a lista de pets, ou para uma rota nova no mock (por exemplo `GET /me/matches`).
- **Cobertura de testes:** a página inicial e a página de detalhe têm menos testes do que as demais.
- **Validação do perfil na leitura:** `useAdopterProfile` converte a resposta à mão (`toAdopterProfile`); poderia passar por um schema Zod como os outros hooks.

## Limitações conhecidas

- **Usuário único e sem autenticação:** tudo fala do usuário `demo`.
- **Estados da solicitação:** `Aprovada` e `Recusada` existem no contrato e na interface, mas o mock não leva uma solicitação até eles.
- **Distância:** calculada a partir de coordenadas fixas, sem geolocalização do navegador.
- **Imagens:** os pets usam URLs externas; não há upload.
- **Compatibilidade:** calculada no cliente, com critérios de peso igual e sem ajuste de pesos.
- **Hospedagem:** o json-server não roda em hospedagem estática (ver [Visão geral](visao-geral.md#publicar-o-frontend)).
- **Módulos fora do escopo:** chat, etapas da solicitação, pós-adoção, avaliações, denúncias, notificações e prontuário.

## Fase 2: backend

Já existem issues de backend e de frontend separadas, cada uma com critérios de aceite. Ordem sugerida:

| Ordem | Issues                   | Tema                                                                                                  |
| ----- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1     | #3                       | Migrar o projeto para monorepo (preparação para o backend)                                            |
| 2     | #9                       | Imagem Docker de banco de dados para persistência real                                                |
| 3     | #47                      | Padrões transversais da API (framework, ORM, erros, validação, docs, logs, testes)                    |
| 4     | #48                      | Usuários e autenticação (cadastro, login e JWT)                                                       |
| 5     | #4 e #5                  | Autenticação no React (login, cadastro e sessão) e middleware de rotas                                |
| 6     | #49, #50, #51 e #18      | Pets, solicitações, favoritos e perfil do adotante na API                                             |
| 7     | #27, #28, #41 e #60      | Organizações, papéis e permissões, e a área da organização                                            |
| 8     | #19 e #33                | Serviço de matching e as recomendações "Para você"                                                    |
| 9     | #20, #21, #22, #34 a #36 | Máquina de estados da solicitação, entrevista e visita, chat, e as telas do adotante e do responsável |
| 10    | #29 e #42                | Prontuário médico do pet                                                                              |
| 11    | #23, #24, #37 e #38      | Adoção e acompanhamento pós-adoção                                                                    |
| 12    | #30, #31, #43 e #44      | Notificações, filtros salvos e alertas                                                                |
| 13    | #25, #26, #39 e #40      | Avaliações, reputação, denúncias e moderação                                                          |

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
3. Abrir o PR `dev` → `main`, para que as issues com "Closes" fechem sozinhas e a `main` receba tudo.
4. Limpar as branches já mescladas.
5. Escolher entre adaptar a #33 (ainda frontend) ou iniciar a fase do backend (#3, #9 e #47).
