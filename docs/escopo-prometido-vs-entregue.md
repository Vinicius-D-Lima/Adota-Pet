# Escopo prometido x entregue

Comparação entre o [Plano de Projeto](plano-de-projeto.md) (versão 1.0, de 01/09/2026) e o que existe hoje na `dev`. Onde a entrega **difere** do plano, a divergência está justificada. Itens que o plano pede e que **não** foram feitos aparecem como pendências, sem maquiagem.

> **Como ler:** ✅ entregue como no plano · ➕ entregue **além** do plano · ⚠️ entregue **diferente** do plano · ❌ não entregue.

## 1. Requisitos funcionais

| Requisito | O plano pede                             | Situação | Como ficou                                                                                                            |
| --------- | ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| REQ-01    | Página inicial com a proposta            | ✅       | `/`, com pets em destaque, fluxo em três passos e chamadas para pets e perfil                                         |
| REQ-02    | Lista de pets                            | ✅       | `/pets`, com paginação "Carregar mais" (4 por vez)                                                                    |
| REQ-03    | Pesquisa por nome, raça ou cidade        | ✅       | Busca com espera de 300 ms; termo fica na URL                                                                         |
| REQ-04    | Filtros por espécie, porte e sexo        | ➕       | Porte aceita **vários valores**; há ordenação e o atalho "Usar minhas preferências"                                   |
| REQ-05    | Favoritar e desfavoritar                 | ➕       | Otimista, com fila, desfaz em caso de erro e ganhou a página `/favoritos`                                             |
| REQ-06    | Detalhes do pet                          | ✅       | Galeria, história, organização e cidade                                                                               |
| REQ-07    | Necessidades e características           | ➕       | Inclui selos de **vacinação e castração**                                                                             |
| REQ-08    | Manter um perfil                         | ➕       | Perfil com CPF, nascimento, e-mail, telefone, CEP e endereço, com validação                                           |
| REQ-09    | Compatibilidade orientativa              | ⚠️       | **7 critérios**, não 6 (ver [divergência 2](#2-sete-critérios-de-compatibilidade-em-vez-de-seis))                     |
| REQ-10    | Percentual e classificação               | ⚠️       | Mesmos limiares (Alta ≥ 80%, Média ≥ 55%), mas com 7 critérios os valores possíveis mudam                             |
| REQ-11    | Critérios atendidos e pontos de atenção  | ✅       | Duas listas na tela de compatibilidade                                                                                |
| REQ-12    | Questionário                             | ✅       | Seis campos                                                                                                           |
| REQ-13    | Validação dos campos obrigatórios        | ➕       | Zod no cliente **e** no servidor; erros por campo                                                                     |
| REQ-14    | Confirmar o envio                        | ✅       | Botão "Revisar e enviar solicitação", protegido contra clique duplo                                                   |
| REQ-15    | Confirmação com o identificador          | ✅       | `/solicitacoes/:id/enviada`, com código, organização e data real                                                      |
| REQ-16    | Listar as solicitações                   | ✅       | `/solicitacoes`                                                                                                       |
| REQ-17    | Mostrar o status                         | ✅       | Indicador visual (`StatusPill`) para os cinco status                                                                  |
| REQ-18    | Cancelar o que ainda puder ser cancelado | ⚠️       | Cancelam-se só `Enviada` e `Em análise` (ver [divergência 3](#3-regra-de-cancelamento-mais-restrita-que-a-do-req-18)) |
| REQ-19    | Editar o perfil                          | ✅       | Formulário em `/perfil` (react-hook-form + Zod)                                                                       |
| REQ-20    | Perfil refletido no próximo cálculo      | ✅       | O perfil salvo alimenta a compatibilidade, o atalho de preferências e a validação do envio                            |

## 2. Requisitos não funcionais

| Requisito | O plano pede                               | Situação | Observação                                                                                                                    |
| --------- | ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| RNF-01    | React + TypeScript                         | ✅       | React 18, TypeScript `strict`                                                                                                 |
| RNF-02    | Rotas do frontend                          | ✅       | react-router-dom 7, rotas do plano mais `/favoritos` e a página 404                                                           |
| RNF-03    | Componentes reutilizáveis                  | ✅       | Biblioteca em `src/components/ui` (ver [Componentes de UI](componentes-ui.md))                                                |
| RNF-04    | Interface responsiva                       | ✅       | Classes responsivas do Tailwind (`md:`, `lg:`), com menu móvel                                                                |
| RNF-05    | Identificação adequada para acessibilidade | ⚠️       | Parcial: rótulos, `aria-*` em formulários e modal, `jsx-a11y` no lint. O pacote completo (#57) foi **revertido** (ver abaixo) |
| RNF-06    | Mensagens claras para vazio e erro         | ➕       | Estados de carregamento, vazio, erro, 404 e Error Boundary em todas as telas                                                  |
| RNF-07    | Funcionar **sem backend próprio**          | ⚠️       | Depende de uma API simulada (ver [divergência 1](#1-api-simulada-e-persistência-em-vez-de-dados-locais))                      |
| RNF-08    | Compatibilidade determinística             | ✅       | Função pura `calculateCompatibility`, com testes de 100%, 86%, 71% e 43%                                                      |
| RNF-09    | Tipagem das principais entidades           | ✅       | Tipos derivados dos schemas Zod                                                                                               |
| RNF-10    | Executável no ambiente da equipe           | ✅       | `npm ci && npm run dev:mock`, no Node 22 (ver [Manual de instalação](manual-de-instalacao.md))                                |

## 3. Divergências e justificativas

### 1. API simulada e persistência em vez de dados locais

- **Plano:** dados "mantidos em variáveis e estado dos componentes", sem API, sem persistência (seções 2.3, 2.4, 2.5 e 12.3; RNF-07). `App.tsx` guardaria perfil, favoritos e solicitações.
- **Entregue:** o frontend consome uma API REST simulada (json-server) em `mock-server/`, com validação, códigos de erro e persistência em `db.json`.
- **Por quê:** o desenvolvimento do frontend foi organizado em issues que já separavam frontend e backend (épicos #45 a #51). Para que o backend real entre depois **sem reescrever o frontend**, o contrato foi fixado cedo: o frontend só conhece a `VITE_API_URL`. O mock também permitiu testar regras de servidor (400, 404, 409, 422) e um **teste de contrato** que pegou um bug real.
- **Efeito no escopo:** não é um backend próprio, e o plano continua valendo no essencial: nenhum dado real, autenticação ou banco de produção. O usuário é um **demo fixo**. O que muda é que os dados sobrevivem a recarregamentos (o plano dizia que não haveria persistência).
- **Custo:** para publicar um link é preciso hospedar o mock à parte (ver [Manual de instalação → Publicação](manual-de-instalacao.md#8-publicação)).

### 2. Sete critérios de compatibilidade em vez de seis

- **Plano:** seis critérios; Alta com 5 ou 6 atendidos, Média com 4 e Baixa com 3 ou menos (seção 10.3).
- **Entregue:** sete. O sétimo é **tempo disponível**: pet de energia Alta com perfil de "Até 1 hora" por dia vira ponto de atenção (PR #80, issue #54).
- **Por quê:** o dado `dailyTime` já existia no perfil e não era usado; o plano e a issue pedem aproveitar dados existentes.
- **Efeito:** os percentuais passam a ser múltiplos de 1/7 (100, 86, 71, 57, 43, 29, 14 e 0). Os limiares de 80% e 55% foram mantidos, e a classificação continua determinística e testada.

### 3. Regra de cancelamento mais restrita que a do REQ-18

- **Plano:** pode cancelar qualquer solicitação com status diferente de `Cancelada` ou `Recusada`. Na prática, isso inclui `Aprovada`.
- **Entregue:** só `Enviada` e `Em análise` cancelam. `Aprovada`, `Recusada` e `Cancelada` não. O servidor responde **409** para as demais, e a interface não mostra o botão.
- **Por quê (justificativa inferida; a regra veio do mock, e o motivo não está registrado no repositório):** uma adoção já aprovada é um acordo com a organização, e cancelá-la com um clique pertence à futura máquina de estados da solicitação (issues #20 a #22). A equipe deve confirmar se é essa a intenção.
- **Pendência:** se a equipe quiser seguir o texto do REQ-18 ao pé da letra, a mudança é pequena (`CANCELLABLE_STATUSES` em `src/utils/requestStatus.ts` e a regra equivalente em `mock-server/server.js`). Fica como **decisão da equipe**; ver [Pendências](#5-pendências-em-relação-ao-plano).

### 4. `Aprovada` e `Recusada` existem, mas só pelo seed

- **Plano:** a lista mostra os cinco status.
- **Entregue:** a interface mostra os cinco. Como não há rota nem área da organização para decidir uma solicitação (fora do escopo), o mock só **cria** `Enviada` e **cancela**. Para a demonstração, o seed traz uma solicitação de cada status (`SOL-1039` a `SOL-1042`).
- **Por quê:** o plano exclui "aprovação real de adoções" e o "painel administrativo para organizações".

### 5. Acessibilidade parcial (#57 revertida)

- **Plano:** RNF-05 e seção 10.2 pedem rótulos e elementos semânticos.
- **Entregue:** rótulos, `aria-invalid`/`aria-describedby` nos campos, modal com foco preso e `inert`, `role="alert"`/`status` e regra `jsx-a11y` no lint. O pacote da issue #57 (menu mobile por teclado, link "pular para o conteúdo", foco visível global, `prefers-reduced-motion`, contraste AA, testes com axe) foi feito no PR #81 e **desfeito** no #82.
- **Estado:** pendência aberta; o caminho de retomada está em [Roadmap → Acessibilidade](roadmap.md#acessibilidade-57).

## 4. Extras entregues além do plano

| Extra                                                  | Onde                                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| Favoritos com página própria e contadores no menu      | `/favoritos`, `Layout`                          |
| Bloqueio proativo de solicitação duplicada             | `useActiveRequestForPet`, `ActiveRequestNotice` |
| Confirmação acessível antes de cancelar                | `ConfirmDialog`                                 |
| Página 404, Error Boundary e carregamento sob demanda  | `NotFoundPage`, `ErrorBoundary`, `React.lazy`   |
| Filtros na URL e atalho "Usar minhas preferências"     | `PetsPage`                                      |
| Teste de contrato entre mock e schemas Zod             | `mock-server/contract.test.js`                  |
| CI (lint, formato, tipos, testes e build) e 169 testes | `.github/workflows/ci.yml`                      |
| Tailwind CSS 4 e react-hook-form                       | Ver [Decisões 16 e 17](decisoes.md)             |
| Manuais de instalação, operação e do usuário           | `docs/manual-*.md`                              |

## 5. Pendências em relação ao plano

| Pendência                                                              | Situação                                                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acessibilidade completa (RNF-05, issue #57)                            | Revertida; decidir se volta                                                                                                                         |
| REQ-18 ao pé da letra (cancelar `Aprovada`)                            | Decisão da equipe (divergência 3)                                                                                                                   |
| Teste do fluxo completo e demonstração (seção 10.5, atividade D16)     | Fluxo coberto por testes automatizados e verificado no navegador; o registro formal do teste de aceite e a demonstração do dia 30/10 cabem à equipe |
| Lições aprendidas, aceite do patrocinador e arquivamento (12.4 e 12.5) | Fora do repositório; cabem ao gerente do projeto                                                                                                    |
| Versão 1.1 do plano refletindo as divergências acima                   | Sugerida; este documento serve de base                                                                                                              |
| Dados do plano que **não** foram verificados contra o código           | Cronograma, orçamento (R$ 14.630,00), horas e riscos são gestão do projeto e não se verificam no repositório                                        |
