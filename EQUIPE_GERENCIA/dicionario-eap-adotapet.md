# Dicionário da EAP — Sistema AdotaPet

**Versão:** 1.0  
**Data:** 05/10/2026  
**Linha de base do escopo:** EAP e declaração do escopo no [Plano de Projeto](<./plano-de-projeto-adotapet%20(2).md>).

Este dicionário detalha os pacotes de trabalho da EAP do Plano de Projeto. Os códigos e nomes dos pacotes seguem a seção 2 daquele plano; os itens abaixo são critérios de aceite do pacote, não atividades adicionais ao cronograma. Cada linha representa um pacote de trabalho. **A** identifica quem presta contas pelo aceite; **R**, quem executa. Atividades abaixo dos pacotes pertencem ao cronograma e não têm aceite próprio. O código do pacote corresponde ao identificador da EAP; marcos, recursos e custos permanecem no cronograma e no orçamento do Plano.

**Equipes e governança**

- **Patrocinador:** Prof. Diogo Mendonça.
- **Gerente do projeto:** GPTI-3 — Pedro Pimentel Nunes.
- **GPTI-1:** Ana Isabel Matias da Silva Basilio.
- **GPTI-2:** Beatriz Cardoso Abdias.
- **GPTI-3:** Pedro Pimentel Nunes.
- **GPTI-4:** Tamires Barbosa dos Santos.
- **PSW-1:** Igor Pereira.
- **PSW-2:** Marcos Vinícius Silvestre.
- **PSW-3:** Lucas Ferreira.
- **Responsabilidade geral:** GPTI planeja, acompanha e valida internamente; PSW implementa e testa o produto. O patrocinador acompanha os marcos e decisões relevantes. Nenhuma organização externa é presumida como participante ou responsável pelo aceite.

## 1.1 Gestão e coordenação do projeto

| Pacote | Entrega                                                 | A      | R                              | Aceite observável                                                                                                                    |
| ------ | ------------------------------------------------------- | ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1.1  | Plano, decisões, requisitos e mudanças acompanhados     | GPTI-3 | GPTI-1 a GPTI-4                | A versão vigente do plano e as decisões de mudança estão identificadas; alterações de escopo, prazo ou risco têm registro e decisão. |
| 1.1.2  | Cronograma, recursos, riscos e custos monitorados       | GPTI-1 | GPTI-1 a GPTI-4                | O status registra esforço realizado/restante, previsão dos marcos, riscos e ações; limites de controle do plano são tratados.        |
| 1.1.3  | Demonstrações e aceites dos marcos registrados          | GPTI-3 | GPTI-1 a GPTI-4; PSW-1 a PSW-3 | Há evidência da demonstração do M1 e M2 e registro de aceite ou de critérios pendentes, com ciência do patrocinador.                 |
| 1.1.4  | Documentação de gestão e lições aprendidas consolidadas | GPTI-4 | GPTI-1 a GPTI-4                | Relatórios, pendências e lições aprendidas são reunidos no encerramento; limitações do protótipo permanecem explícitas.              |

## 1.2 Requisitos e desenho funcional

| Pacote | Entrega                                                 | A      | R                              | Aceite observável                                                                                                                         |
| ------ | ------------------------------------------------------- | ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1.2.1  | Atores, papéis e 17 casos de uso detalhados             | GPTI-3 | GPTI-1 a GPTI-4; PSW-1 a PSW-3 | Os 17 casos de uso e os papéis de adotante e responsável estão descritos e rastreáveis, sem atribuir validação externa às regras.         |
| 1.2.2  | Fluxos de adoção do adotante e do responsável definidos | GPTI-2 | GPTI-2; PSW-1 e PSW-3          | Os fluxos cobrem consulta, perfil, solicitação, análise, decisão, cancelamento permitido e conclusão da adoção.                           |
| 1.2.3  | Regras de negócio, estados e validações definidos       | GPTI-1 | GPTI-1; PSW-2                  | Regras de autorização, disponibilidade, compatibilidade, questionário e transições de solicitação têm critérios verificáveis.             |
| 1.2.4  | Modelo de domínio e contratos de API definidos          | PSW-2  | PSW-1 a PSW-3; GPTI-2          | Usuários, pets, perfis, favoritos, solicitações e adoções têm estruturas e contratos compatíveis com o escopo e as integrações previstas. |
| 1.2.5  | Dados fictícios, premissas e limitações documentados    | GPTI-4 | GPTI-4; PSW-3                  | Está explícito que identidades/dados são fictícios, OAuth é mockado e não há operação de produção nem integração externa.                 |
| 1.2.6  | Navegação e telas revisadas internamente                | GPTI-2 | GPTI-1 a GPTI-4; PSW-1 a PSW-3 | A navegação cobre os fluxos priorizados do M1 e não deixa ações ou estados necessários sem representação.                                 |

## 1.3 Base técnica e ambientes

| Pacote | Entrega                                                       | A     | R                       | Aceite observável                                                                                                                          |
| ------ | ------------------------------------------------------------- | ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.3.1  | Frontend React + TypeScript preparado                         | PSW-1 | PSW-1 a PSW-3           | A aplicação inicia e apresenta a estrutura necessária para os fluxos do AdotaPet.                                                          |
| 1.3.2  | API REST Node.js + Express preparada                          | PSW-2 | PSW-1 a PSW-3           | A API inicia, expõe rotas próprias e aplica validações e tratamento explícito de erros.                                                    |
| 1.3.3  | MongoDB configurado para desenvolvimento                      | PSW-3 | PSW-1 a PSW-3           | A API conecta ao banco de desenvolvimento e persiste os dados fictícios previstos, sem acesso direto do frontend ao banco.                 |
| 1.3.4  | Validação, erros e contratos de dados implementados           | PSW-2 | PSW-1 a PSW-3           | Requisições inválidas e falhas de autorização/regra retornam respostas identificáveis segundo os contratos definidos.                      |
| 1.3.5  | Identidades fictícias e permissões por papel preparadas       | PSW-3 | PSW-1 a PSW-3           | Os cenários de adotante e responsável podem ser demonstrados com identidade fictícia; OAuth não chama provedor externo.                    |
| 1.3.6  | Endpoints mantidos no `json-server` identificados no contrato | PSW-2 | PSW-2; GPTI-4 (revisão) | Cada endpoint simulado remanescente tem finalidade e contrato identificados; não há dependência simulada apresentada como integração real. |

## 1.4 Marco 1 — Frontend dos fluxos prioritários com serviços simulados

| Pacote | Entrega                                                         | A      | R                              | Aceite observável                                                                                                              |
| ------ | --------------------------------------------------------------- | ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 1.4.1  | Página inicial, catálogo, busca, filtros e detalhes construídos | PSW-1  | PSW-1 a PSW-3                  | A demonstração permite localizar pets fictícios, filtrar resultados e consultar detalhes.                                      |
| 1.4.2  | Perfil, compatibilidade e favoritos demonstráveis               | PSW-2  | PSW-1 e PSW-2                  | É possível demonstrar o perfil usado na compatibilidade, resultado orientativo e gerenciamento de favoritos.                   |
| 1.4.3  | Questionário e criação de solicitação demonstráveis             | PSW-3  | PSW-2 e PSW-3                  | O questionário aceita os dados previstos, apresenta validações e permite demonstrar o envio de uma solicitação fictícia.       |
| 1.4.4  | Navegação, estados de erro e estados vazios demonstráveis       | PSW-1  | PSW-1 a PSW-3                  | Os fluxos prioritários apresentam navegação e estados vazios/de erro compreensíveis, sem telas que aparentem sucesso indevido. |
| 1.4.5  | Serviços simulados e identidade fictícia documentados           | GPTI-4 | GPTI-4; PSW-2                  | Os mocks e a identidade demonstrativa estão delimitados e documentados como simulações acadêmicas.                             |
| 1.4.6  | Demonstração do M1 e pendências registradas                     | GPTI-3 | GPTI-1 a GPTI-4; PSW-1 a PSW-3 | A demonstração ocorre no marco previsto; aceite ou pendências são registrados com evidências e ciência do patrocinador.        |

## 1.5 Backend e regras de negócio

| Pacote | Entrega                                                              | A     | R             | Aceite observável                                                                                                          |
| ------ | -------------------------------------------------------------------- | ----- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1.5.1  | CRUD de usuários com identidade fictícia e autorização implementado  | PSW-1 | PSW-1 a PSW-3 | Operações previstas persistem e respeitam papel e vínculo do usuário, com erros explícitos para operações não autorizadas. |
| 1.5.2  | CRUD de pets com propriedade e disponibilidade implementado          | PSW-3 | PSW-1 a PSW-3 | O responsável administra seus pets; pet com vínculos não é removido de forma a deixar dados inconsistentes.                |
| 1.5.3  | Pesquisa, filtros, ordenação e paginação implementados               | PSW-2 | PSW-1 a PSW-3 | Consultas respeitam o contrato e retornam somente os pets elegíveis/disponíveis conforme as regras.                        |
| 1.5.4  | Perfil, favoritos e compatibilidade integrados aos dados persistidos | PSW-2 | PSW-1 a PSW-3 | Perfil e favoritos persistem; compatibilidade é determinística, explicável e não decide automaticamente a adoção.          |
| 1.5.5  | Questionário e criação/consulta de solicitações implementados        | PSW-3 | PSW-1 a PSW-3 | Solicitações válidas são persistidas e consultáveis; dados inválidos são recusados pela API.                               |
| 1.5.6  | Aprovação, recusa e cancelamento implementados conforme os estados   | PSW-1 | PSW-1 a PSW-3 | Apenas transições permitidas para o papel e estado atual são aceitas; as demais retornam erro explícito.                   |
| 1.5.7  | Conclusão da adoção e atualização da disponibilidade implementadas   | PSW-3 | PSW-1 a PSW-3 | A conclusão registra o vínculo de adoção e impede novas solicitações para o pet indisponível.                              |
| 1.5.8  | Persistência dos dados de negócio configurada no MongoDB             | PSW-2 | PSW-1 a PSW-3 | Usuários, pets, perfis, favoritos, solicitações e adoções persistem e são acessados pelo frontend somente pela API.        |

## 1.6 Integração frontend, API e persistência

| Pacote | Entrega                                                              | A     | R                       | Aceite observável                                                                                                                 |
| ------ | -------------------------------------------------------------------- | ----- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1.6.1  | Fluxos do adotante conectados à API                                  | PSW-1 | PSW-1 a PSW-3           | Pesquisa, perfil, favoritos, compatibilidade e solicitações utilizam os contratos acordados e dados persistidos.                  |
| 1.6.2  | Área do responsável conectada à API                                  | PSW-3 | PSW-1 a PSW-3           | Gestão de pets e análise de solicitações usam a API própria com autorização por papel.                                            |
| 1.6.3  | Dados persistidos e respostas validadas conforme os contratos        | PSW-2 | PSW-1 a PSW-3           | Os fluxos integrados mantêm consistência dos dados entre operações e a interface interpreta as respostas previstas.               |
| 1.6.4  | Erros de validação, autorização e negócio apresentados adequadamente | PSW-1 | PSW-1 a PSW-3           | A interface comunica erros recebidos sem apresentá-los como sucesso nem ocultar a causa para o usuário.                           |
| 1.6.5  | Endpoints ainda simulados identificados e delimitados                | PSW-2 | PSW-2; GPTI-4 (revisão) | As rotas restantes no `json-server` estão listadas e não substituem a API própria nos fluxos que exigem persistência do AdotaPet. |

## 1.7 Verificação, demonstração e encerramento

| Pacote | Entrega                                                      | A      | R                              | Aceite observável                                                                                                                   |
| ------ | ------------------------------------------------------------ | ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1.7.1  | Testes funcionais, de API, contrato e autorização executados | PSW-2  | PSW-1 a PSW-3                  | Resultados registram cenários executados e falhas, incluindo permissões e respostas de erro.                                        |
| 1.7.2  | Fluxos ponta a ponta testados e defeitos críticos corrigidos | PSW-3  | PSW-1 a PSW-3; GPTI-1 a GPTI-4 | Os fluxos prioritários executam com persistência e os defeitos críticos impeditivos estão corrigidos ou registrados como pendência. |
| 1.7.3  | Instruções de execução e documentação técnica entregues      | PSW-1  | PSW-1 a PSW-3                  | Documentação permite preparar e executar o protótipo e descreve arquitetura, API, dependências e limitações.                        |
| 1.7.4  | Demonstração final e aceite ou pendências do M2 registrados  | GPTI-4 | GPTI-1 a GPTI-4; PSW-1 a PSW-3 | Os critérios do M2 são demonstrados; aceite ou pendências ficam registrados com ciência do patrocinador.                            |
| 1.7.5  | Limitações e lições aprendidas documentadas                  | GPTI-3 | GPTI-1 a GPTI-4; PSW-2         | O encerramento separa entregas aceitas, pendências e itens fora do escopo, sem sugerir prontidão para produção.                     |
