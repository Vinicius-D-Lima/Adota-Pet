# Dicionário da EAP — Sistema AdotaPet

**Versão:** 1.0  
**Data:** 05/10/2026  
**Linha de base do escopo:** EAP e declaração do escopo no [Plano de Projeto](<./plano-de-projeto-adotapet%20(2).md>).

Este dicionário detalha os pacotes de trabalho da EAP do Plano de Projeto. Os códigos e nomes dos pacotes seguem a seção 2 daquele plano; os itens abaixo são critérios de aceite do pacote, não atividades adicionais ao cronograma. **A** identifica quem responde pela validação do pacote; **R**, quem executa. O aceite é registrado nos marcos e nas evidências do projeto.

**Equipes e governança**

- **Patrocinador:** Prof. Diogo Mendonça.
- **Gerente do projeto:** Pedro Pimentel Nunes.
- **Equipe GPTI (gestão e validação interna):** Ana Isabel Matias da Silva Basilio, Beatriz Cardoso Abdias, Pedro Pimentel Nunes e Tamires Barbosa dos Santos.
- **Equipe PSW (produto e desenvolvimento):** Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira.
- **Responsabilidade geral:** GPTI planeja, acompanha e valida internamente; PSW implementa e testa o produto. O patrocinador acompanha os marcos e decisões relevantes. Nenhuma organização externa é presumida como participante ou responsável pelo aceite.

## 1.1 Gestão e coordenação do projeto

| Pacote | Entrega                                                 | A                    | R                  | Aceite observável                                                                                                                    |
| ------ | ------------------------------------------------------- | -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1.1  | Plano, decisões, requisitos e mudanças acompanhados     | Pedro Pimentel Nunes | Equipe GPTI        | A versão vigente do plano e as decisões de mudança estão identificadas; alterações de escopo, prazo ou risco têm registro e decisão. |
| 1.1.2  | Cronograma, recursos, riscos e custos monitorados       | Pedro Pimentel Nunes | Equipe GPTI        | O status registra esforço realizado/restante, previsão dos marcos, riscos e ações; limites de controle do plano são tratados.        |
| 1.1.3  | Demonstrações e aceites dos marcos registrados          | Pedro Pimentel Nunes | Equipes GPTI e PSW | Há evidência da demonstração do M1 e M2 e registro de aceite ou de critérios pendentes, com ciência do patrocinador.                 |
| 1.1.4  | Documentação de gestão e lições aprendidas consolidadas | Pedro Pimentel Nunes | Equipe GPTI        | Relatórios, pendências e lições aprendidas são reunidos no encerramento; limitações do protótipo permanecem explícitas.              |

## 1.2 Requisitos e desenho funcional

| Pacote | Entrega                                                 | A                    | R                            | Aceite observável                                                                                                                         |
| ------ | ------------------------------------------------------- | -------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1.2.1  | Atores, papéis e 17 casos de uso detalhados             | Pedro Pimentel Nunes | Equipes GPTI e PSW           | Os 17 casos de uso e os papéis de adotante e responsável estão descritos e rastreáveis, sem atribuir validação externa às regras.         |
| 1.2.2  | Fluxos de adoção do adotante e do responsável definidos | Pedro Pimentel Nunes | Equipes GPTI e PSW           | Os fluxos cobrem consulta, perfil, solicitação, análise, decisão, cancelamento permitido e conclusão da adoção.                           |
| 1.2.3  | Regras de negócio, estados e validações definidos       | Pedro Pimentel Nunes | Equipes GPTI e PSW           | Regras de autorização, disponibilidade, compatibilidade, questionário e transições de solicitação têm critérios verificáveis.             |
| 1.2.4  | Modelo de domínio e contratos de API definidos          | Pedro Pimentel Nunes | Equipe PSW, com revisão GPTI | Usuários, pets, perfis, favoritos, solicitações e adoções têm estruturas e contratos compatíveis com o escopo e as integrações previstas. |
| 1.2.5  | Dados fictícios, premissas e limitações documentados    | Pedro Pimentel Nunes | Equipe GPTI, com apoio PSW   | Está explícito que identidades/dados são fictícios, OAuth é mockado e não há operação de produção nem integração externa.                 |
| 1.2.6  | Navegação e telas revisadas internamente                | Pedro Pimentel Nunes | Equipes GPTI e PSW           | A navegação cobre os fluxos priorizados do M1 e não deixa ações ou estados necessários sem representação.                                 |

## 1.3 Base técnica e ambientes

| Pacote | Entrega                                                       | A          | R                            | Aceite observável                                                                                                                          |
| ------ | ------------------------------------------------------------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.3.1  | Frontend React + TypeScript preparado                         | Equipe PSW | Equipe PSW                   | A aplicação inicia e apresenta a estrutura necessária para os fluxos do AdotaPet.                                                          |
| 1.3.2  | API REST Node.js + Express preparada                          | Equipe PSW | Equipe PSW                   | A API inicia, expõe rotas próprias e aplica validações e tratamento explícito de erros.                                                    |
| 1.3.3  | MongoDB configurado para desenvolvimento                      | Equipe PSW | Equipe PSW                   | A API conecta ao banco de desenvolvimento e persiste os dados fictícios previstos, sem acesso direto do frontend ao banco.                 |
| 1.3.4  | Validação, erros e contratos de dados implementados           | Equipe PSW | Equipe PSW                   | Requisições inválidas e falhas de autorização/regra retornam respostas identificáveis segundo os contratos definidos.                      |
| 1.3.5  | Identidades fictícias e permissões por papel preparadas       | Equipe PSW | Equipe PSW                   | Os cenários de adotante e responsável podem ser demonstrados com identidade fictícia; OAuth não chama provedor externo.                    |
| 1.3.6  | Endpoints mantidos no `json-server` identificados no contrato | Equipe PSW | Equipe PSW, com revisão GPTI | Cada endpoint simulado remanescente tem finalidade e contrato identificados; não há dependência simulada apresentada como integração real. |

## 1.4 Marco 1 — Frontend dos fluxos prioritários com serviços simulados

| Pacote | Entrega                                                         | A                    | R                  | Aceite observável                                                                                                              |
| ------ | --------------------------------------------------------------- | -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 1.4.1  | Página inicial, catálogo, busca, filtros e detalhes construídos | Equipe PSW           | Equipe PSW         | A demonstração permite localizar pets fictícios, filtrar resultados e consultar detalhes.                                      |
| 1.4.2  | Perfil, compatibilidade e favoritos demonstráveis               | Equipe PSW           | Equipe PSW         | É possível demonstrar o perfil usado na compatibilidade, resultado orientativo e gerenciamento de favoritos.                   |
| 1.4.3  | Questionário e criação de solicitação demonstráveis             | Equipe PSW           | Equipe PSW         | O questionário aceita os dados previstos, apresenta validações e permite demonstrar o envio de uma solicitação fictícia.       |
| 1.4.4  | Navegação, estados de erro e estados vazios demonstráveis       | Equipe PSW           | Equipe PSW         | Os fluxos prioritários apresentam navegação e estados vazios/de erro compreensíveis, sem telas que aparentem sucesso indevido. |
| 1.4.5  | Serviços simulados e identidade fictícia documentados           | Equipe GPTI          | Equipes GPTI e PSW | Os mocks e a identidade demonstrativa estão delimitados e documentados como simulações acadêmicas.                             |
| 1.4.6  | Demonstração do M1 e pendências registradas                     | Pedro Pimentel Nunes | Equipes GPTI e PSW | A demonstração ocorre no marco previsto; aceite ou pendências são registrados com evidências e ciência do patrocinador.        |

## 1.5 Backend e regras de negócio

| Pacote | Entrega                                                              | A          | R          | Aceite observável                                                                                                          |
| ------ | -------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1.5.1  | CRUD de usuários com identidade fictícia e autorização implementado  | Equipe PSW | Equipe PSW | Operações previstas persistem e respeitam papel e vínculo do usuário, com erros explícitos para operações não autorizadas. |
| 1.5.2  | CRUD de pets com propriedade e disponibilidade implementado          | Equipe PSW | Equipe PSW | O responsável administra seus pets; pet com vínculos não é removido de forma a deixar dados inconsistentes.                |
| 1.5.3  | Pesquisa, filtros, ordenação e paginação implementados               | Equipe PSW | Equipe PSW | Consultas respeitam o contrato e retornam somente os pets elegíveis/disponíveis conforme as regras.                        |
| 1.5.4  | Perfil, favoritos e compatibilidade integrados aos dados persistidos | Equipe PSW | Equipe PSW | Perfil e favoritos persistem; compatibilidade é determinística, explicável e não decide automaticamente a adoção.          |
| 1.5.5  | Questionário e criação/consulta de solicitações implementados        | Equipe PSW | Equipe PSW | Solicitações válidas são persistidas e consultáveis; dados inválidos são recusados pela API.                               |
| 1.5.6  | Aprovação, recusa e cancelamento implementados conforme os estados   | Equipe PSW | Equipe PSW | Apenas transições permitidas para o papel e estado atual são aceitas; as demais retornam erro explícito.                   |
| 1.5.7  | Conclusão da adoção e atualização da disponibilidade implementadas   | Equipe PSW | Equipe PSW | A conclusão registra o vínculo de adoção e impede novas solicitações para o pet indisponível.                              |
| 1.5.8  | Persistência dos dados de negócio configurada no MongoDB             | Equipe PSW | Equipe PSW | Usuários, pets, perfis, favoritos, solicitações e adoções persistem e são acessados pelo frontend somente pela API.        |

## 1.6 Integração frontend, API e persistência

| Pacote | Entrega                                                              | A          | R                            | Aceite observável                                                                                                                 |
| ------ | -------------------------------------------------------------------- | ---------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1.6.1  | Fluxos do adotante conectados à API                                  | Equipe PSW | Equipe PSW                   | Pesquisa, perfil, favoritos, compatibilidade e solicitações utilizam os contratos acordados e dados persistidos.                  |
| 1.6.2  | Área do responsável conectada à API                                  | Equipe PSW | Equipe PSW                   | Gestão de pets e análise de solicitações usam a API própria com autorização por papel.                                            |
| 1.6.3  | Dados persistidos e respostas validadas conforme os contratos        | Equipe PSW | Equipe PSW                   | Os fluxos integrados mantêm consistência dos dados entre operações e a interface interpreta as respostas previstas.               |
| 1.6.4  | Erros de validação, autorização e negócio apresentados adequadamente | Equipe PSW | Equipe PSW                   | A interface comunica erros recebidos sem apresentá-los como sucesso nem ocultar a causa para o usuário.                           |
| 1.6.5  | Endpoints ainda simulados identificados e delimitados                | Equipe PSW | Equipe PSW, com revisão GPTI | As rotas restantes no `json-server` estão listadas e não substituem a API própria nos fluxos que exigem persistência do AdotaPet. |

## 1.7 Verificação, demonstração e encerramento

| Pacote | Entrega                                                      | A                    | R                          | Aceite observável                                                                                                                   |
| ------ | ------------------------------------------------------------ | -------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1.7.1  | Testes funcionais, de API, contrato e autorização executados | Equipe PSW           | Equipe PSW                 | Resultados registram cenários executados e falhas, incluindo permissões e respostas de erro.                                        |
| 1.7.2  | Fluxos ponta a ponta testados e defeitos críticos corrigidos | Equipe PSW           | Equipes PSW e GPTI         | Os fluxos prioritários executam com persistência e os defeitos críticos impeditivos estão corrigidos ou registrados como pendência. |
| 1.7.3  | Instruções de execução e documentação técnica entregues      | Equipe PSW           | Equipe PSW                 | Documentação permite preparar e executar o protótipo e descreve arquitetura, API, dependências e limitações.                        |
| 1.7.4  | Demonstração final e aceite ou pendências do M2 registrados  | Pedro Pimentel Nunes | Equipes GPTI e PSW         | Os critérios do M2 são demonstrados; aceite ou pendências ficam registrados com ciência do patrocinador.                            |
| 1.7.5  | Limitações e lições aprendidas documentadas                  | Pedro Pimentel Nunes | Equipe GPTI, com apoio PSW | O encerramento separa entregas aceitas, pendências e itens fora do escopo, sem sugerir prontidão para produção.                     |
