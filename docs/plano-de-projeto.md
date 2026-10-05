# Plano de Projeto — AdotaPet

**Versão:** 1.0
**Data de elaboração:** 01/09/2026
**Patrocinador:** Diretor de Produto — AdotaPet
**Gerente do projeto:** Igor Pereira
**Equipe:** Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira
**Período de execução:** 01/09/2026 a 30/10/2026 (9 semanas de calendário)
**Esforço total planejado:** 256 horas-pessoa
**Orçamento (valor econômico estimado):** R$ 14.630,00

> Este documento apresenta o plano de gerenciamento do projeto AdotaPet, contemplando declaração do escopo, requisitos, matriz de rastreabilidade, EAP, cronograma, recursos, custos, riscos, partes interessadas, qualidade, comunicações, responsabilidades, critérios de aceite e encerramento.
>
> O produto desta etapa é um **protótipo funcional de frontend para adoção responsável**, desenvolvido em React + TypeScript. Os dados utilizados pelo protótipo são locais, mantidos em variáveis e estado dos componentes, não havendo API, banco de dados, autenticação real ou persistência externa.

---

# 1. Objetivo da EAP

A Estrutura Analítica do Projeto (EAP) decompõe o desenvolvimento do AdotaPet em entregas e componentes gerenciáveis, permitindo controlar o escopo, distribuir responsabilidades, estimar esforço e acompanhar a evolução do protótipo.

A EAP é orientada às **entregas do produto**; sua numeração representa a hierarquia dos componentes, não a ordem cronológica de execução.

As informações sobre pets, organizações, perfil do adotante e solicitações são dados simulados. O protótipo demonstra o fluxo de adoção responsável, mas não representa um sistema operacional de uma organização de proteção animal.

## 1.1 Estrutura Analítica do Projeto

```text
1. AdotaPet
│
├── 1.1 Gestão do Projeto
│   ├── 1.1.1 Planejamento
│   ├── 1.1.2 Controle de escopo
│   ├── 1.1.3 Controle de prazo
│   ├── 1.1.4 Controle de riscos
│   └── 1.1.5 Encerramento
│
├── 1.2 Requisitos e desenho do produto
│   ├── 1.2.1 Levantamento do fluxo de adoção
│   ├── 1.2.2 Definição dos dados de pets
│   ├── 1.2.3 Definição do perfil do adotante
│   ├── 1.2.4 Definição das regras de compatibilidade
│   └── 1.2.5 Definição dos critérios de validação
│
├── 1.3 Base técnica do frontend
│   ├── 1.3.1 Configuração React + TypeScript
│   ├── 1.3.2 Configuração de rotas
│   ├── 1.3.3 Tipagem das entidades
│   ├── 1.3.4 Dados simulados
│   └── 1.3.5 Componentes reutilizáveis
│
├── 1.4 Apresentação e descoberta de pets
│   ├── 1.4.1 Página inicial
│   ├── 1.4.2 Catálogo de pets
│   ├── 1.4.3 Pesquisa
│   ├── 1.4.4 Filtros
│   ├── 1.4.5 Favoritos
│   └── 1.4.6 Detalhes do pet
│
├── 1.5 Perfil e compatibilidade
│   ├── 1.5.1 Cadastro do perfil do adotante
│   ├── 1.5.2 Edição do perfil
│   ├── 1.5.3 Regras de compatibilidade
│   ├── 1.5.4 Cálculo do percentual
│   └── 1.5.5 Apresentação dos pontos positivos e de atenção
│
├── 1.6 Questionário de adoção
│   ├── 1.6.1 Motivação
│   ├── 1.6.2 Rotina
│   ├── 1.6.3 Tempo que o pet ficará sozinho
│   ├── 1.6.4 Plano de adaptação
│   ├── 1.6.5 Confirmação dos custos
│   ├── 1.6.6 Confirmação do compromisso
│   └── 1.6.7 Validação do formulário
│
├── 1.7 Solicitações de adoção
│   ├── 1.7.1 Criação da solicitação
│   ├── 1.7.2 Tela de confirmação
│   ├── 1.7.3 Listagem das solicitações
│   ├── 1.7.4 Exibição de status
│   └── 1.7.5 Cancelamento
│
├── 1.8 Interface e componentes compartilhados
│   ├── 1.8.1 Layout e navegação
│   ├── 1.8.2 Indicador das etapas do fluxo
│   ├── 1.8.3 Cartões de pets
│   ├── 1.8.4 Campos e formulários
│   ├── 1.8.5 Indicadores de status
│   └── 1.8.6 Mensagens e estados vazios
│
└── 1.9 Verificação, demonstração e encerramento
    ├── 1.9.1 Testes funcionais
    ├── 1.9.2 Correção de defeitos
    ├── 1.9.3 Teste do fluxo completo
    ├── 1.9.4 Demonstração
    └── 1.9.5 Documentação e encerramento
```

## 1.2 Pacotes principais

| Pacote | Entrega |
| ------ | ------- |
| 1.1 | Gestão e acompanhamento do projeto |
| 1.2 | Requisitos, regras e desenho funcional |
| 1.3 | Base técnica React + TypeScript |
| 1.4 | Descoberta, pesquisa e visualização de pets |
| 1.5 | Perfil do adotante e compatibilidade |
| 1.6 | Questionário de adoção |
| 1.7 | Solicitações de adoção |
| 1.8 | Componentes e estrutura visual compartilhada |
| 1.9 | Testes, demonstração e encerramento |

---

# 2. Declaração do escopo

## 2.1 Objetivo do produto

O AdotaPet disponibiliza, nesta primeira etapa, um protótipo funcional de uma plataforma de adoção responsável, permitindo que o usuário conheça animais disponíveis, filtre pets por características básicas, consulte suas necessidades, avalie uma compatibilidade orientativa com seu perfil, responda a um questionário e simule o envio e o acompanhamento de uma solicitação de adoção.

O fluxo implementado contempla:

1. apresentação do AdotaPet;
2. pesquisa e filtragem de pets;
3. visualização dos detalhes e necessidades do animal;
4. cálculo de compatibilidade;
5. preenchimento e validação do questionário;
6. envio e confirmação da solicitação;
7. acompanhamento e cancelamento das solicitações;
8. edição do perfil utilizado no cálculo de compatibilidade.

O fluxo é representado no frontend pelas etapas **Conhecer o pet, Compatibilidade, Questionário e Solicitação**.

## 2.2 Escopo incluído

* página inicial e apresentação do conceito de adoção responsável;
* catálogo de pets com cards e indicação de distância;
* pesquisa por nome, raça ou cidade;
* filtros por espécie, porte e sexo;
* sistema de favoritos;
* página de detalhes com galeria, características, necessidades e organização responsável;
* perfil do adotante e sua edição;
* cálculo de compatibilidade, com percentual, classificação (Alta, Média ou Baixa), critérios atendidos e pontos de atenção;
* questionário de adoção com validação de campos, confirmação de custos recorrentes e confirmação de compromisso com o bem-estar do pet;
* criação de solicitação com geração de identificador e tela de confirmação;
* listagem de solicitações com status (Enviada, Em análise, Aprovada, Recusada ou Cancelada) e cancelamento;
* navegação entre as etapas do processo.

## 2.3 Escopo técnico

* React;
* TypeScript;
* React Router;
* Lucide React (ícones);
* estado local dos componentes;
* dados simulados;
* componentes reutilizáveis.

Rotas principais: `/`, `/pets`, `/pets/:petId`, `/pets/:petId/compatibilidade`, `/pets/:petId/questionario`, `/solicitacoes`, `/solicitacoes/:requestId/enviada` e `/perfil`.

## 2.4 Fora do escopo

Não fazem parte desta versão: API backend; banco de dados; persistência dos dados; autenticação real; cadastro real de usuários; integração com organizações reais; envio de e-mails; notificações; pagamentos; painel administrativo para organizações; cadastro real de pets; aprovação real de adoções; contato real entre adotante e organização; agendamento de visitas; geolocalização e cálculo de distância em tempo real; inteligência artificial para recomendação; aplicativo mobile nativo; publicação em lojas de aplicativos; infraestrutura de produção.

O componente `App.tsx` mantém perfil, favoritos e solicitações em estado local. Os casos de uso de gestão de contas e de pets e a análise das solicitações pelo responsável pertencem a etapas futuras do sistema (seção 2.7).

## 2.5 Premissas

* O usuário acessará o sistema por navegador.
* Os pets e as organizações apresentados são dados fictícios de demonstração.
* A compatibilidade tem caráter orientativo; a decisão de adoção cabe à organização responsável.
* Não haverá persistência após o encerramento da execução da aplicação.
* A equipe estará disponível conforme o plano de recursos (seção 6).
* O projeto utilizará ferramentas gratuitas ou já disponíveis para a equipe.

## 2.6 Restrições

* ausência de backend, banco de dados e API externa;
* prazo fixo de 9 semanas (01/09/2026 a 30/10/2026), definido pelo patrocinador;
* disponibilidade parcial da equipe;
* necessidade de manter o projeto dentro do escopo de um protótipo frontend;
* dados simulados;
* ausência de infraestrutura de produção.

## 2.7 Visão do sistema AdotaPet e casos de uso

**Propósito do sistema:** o AdotaPet facilita o processo de adoção de animais, conectando pessoas físicas e organizações que possuem pets disponíveis com usuários interessados em adotá-los. O sistema completo prevê o cadastro e a divulgação dos animais, buscas e filtros (espécie, porte, idade, sexo e localização) e o início do processo de adoção pela plataforma.

**Justificativa:** hoje a divulgação ocorre em redes sociais e grupos de mensagens, com informações dispersas e atendimento individual a cada interessado. O AdotaPet centraliza divulgação, busca e acompanhamento das solicitações em uma única plataforma.

**Fluxo de negócio do sistema:** Cadastro do responsável → Cadastro do pet → Busca e filtragem → Visualização do pet → Solicitação de adoção → Análise da solicitação → Aprovação/recusa → Conclusão da adoção.

**Atores:** Adotante; Responsável pelo pet / Organização; Usuário (gestão da própria conta).

**Entidades de domínio:** Usuário, Responsável, Pet, Solicitação de Adoção, Adoção e Organização. Espécie, porte e sexo são atributos ou enumerações da entidade Pet.

**Cobertura dos 17 casos de uso nesta etapa:** o protótipo cobre o lado do adotante, ou seja, 9 dos 17 casos de uso, total ou parcialmente.

| Caso de uso | Situação nesta etapa | Requisitos |
| ----------- | -------------------- | ---------- |
| Cadastrar usuário | Fora do escopo | — |
| Consultar usuário | Parcial (visualização do perfil do adotante) | REQ-08 |
| Atualizar usuário | Parcial (edição do perfil do adotante) | REQ-19 |
| Excluir usuário | Fora do escopo | — |
| Cadastrar pet | Fora do escopo (pets vêm dos dados simulados) | — |
| Consultar pet | Incluído | REQ-02, REQ-06 |
| Atualizar pet | Fora do escopo | — |
| Excluir pet | Fora do escopo | — |
| Pesquisar pets | Incluído | REQ-03 |
| Filtrar pets | Incluído | REQ-04 |
| Visualizar detalhes do pet | Incluído | REQ-06, REQ-07 |
| Solicitar adoção | Incluído | REQ-12 a REQ-15 |
| Consultar solicitações de adoção | Incluído | REQ-16, REQ-17 |
| Aprovar solicitação de adoção | Fora do escopo (decisão do responsável) | — |
| Recusar solicitação de adoção | Fora do escopo (decisão do responsável) | — |
| Cancelar solicitação de adoção | Incluído | REQ-18 |
| Finalizar adoção | Fora do escopo | — |

---

# 3. Requisitos do projeto

Os requisitos derivam das funcionalidades do protótipo e dos objetivos do fluxo de adoção.

## 3.1 Requisitos funcionais

| ID | Requisito |
| -- | --------- |
| REQ-01 | O sistema deve apresentar uma página inicial com a proposta de adoção responsável. |
| REQ-02 | O sistema deve permitir visualizar a lista de pets disponíveis. |
| REQ-03 | O sistema deve permitir pesquisar pets por nome, raça ou cidade. |
| REQ-04 | O sistema deve permitir filtrar pets por espécie, porte e sexo. |
| REQ-05 | O sistema deve permitir favoritar e desfavoritar pets. |
| REQ-06 | O sistema deve apresentar detalhes do pet selecionado. |
| REQ-07 | O sistema deve apresentar as necessidades e características do pet. |
| REQ-08 | O sistema deve permitir manter um perfil do adotante. |
| REQ-09 | O sistema deve calcular uma compatibilidade orientativa entre pet e adotante. |
| REQ-10 | O sistema deve apresentar percentual e classificação de compatibilidade. |
| REQ-11 | O sistema deve apresentar critérios atendidos e pontos de atenção. |
| REQ-12 | O sistema deve permitir preencher um questionário de adoção. |
| REQ-13 | O sistema deve validar os campos obrigatórios do questionário. |
| REQ-14 | O sistema deve permitir confirmar o envio de uma solicitação. |
| REQ-15 | O sistema deve apresentar uma confirmação com o identificador da solicitação. |
| REQ-16 | O sistema deve listar as solicitações realizadas. |
| REQ-17 | O sistema deve apresentar o status das solicitações. |
| REQ-18 | O sistema deve permitir cancelar solicitações que ainda possam ser canceladas, ou seja, aquelas com status diferente de Cancelada ou Recusada. |
| REQ-19 | O sistema deve permitir editar o perfil do adotante. |
| REQ-20 | O sistema deve refletir alterações no perfil nos próximos cálculos de compatibilidade. |

## 3.2 Requisitos não funcionais

| ID | Requisito |
| -- | --------- |
| RNF-01 | A aplicação deve ser desenvolvida em React + TypeScript. |
| RNF-02 | A navegação entre as páginas deve utilizar rotas do frontend. |
| RNF-03 | Componentes comuns devem ser reutilizados sempre que possível. |
| RNF-04 | A interface deve possuir comportamento responsivo. |
| RNF-05 | Elementos interativos devem possuir identificação adequada para acessibilidade. |
| RNF-06 | O sistema deve apresentar mensagens claras para estados vazios e erros de preenchimento. |
| RNF-07 | O protótipo deve funcionar sem dependência de um backend próprio. |
| RNF-08 | As regras de compatibilidade devem ser determinísticas e reproduzíveis. |
| RNF-09 | O código deve utilizar tipagem TypeScript para as principais entidades. |
| RNF-10 | O projeto deve permanecer executável no ambiente de desenvolvimento definido pela equipe. |

---

# 4. Matriz de rastreabilidade

| ID | Pacotes EAP | Aceite observável |
| -- | ----------- | ----------------- |
| REQ-01 | 1.4.1 | A página inicial apresenta a proposta do AdotaPet e direciona o usuário ao catálogo ou ao perfil. |
| REQ-02 | 1.4.2 | O usuário visualiza os pets cadastrados nos dados simulados. |
| REQ-03 | 1.4.3 | Uma busca por nome, raça ou cidade reduz a lista aos pets correspondentes. |
| REQ-04 | 1.4.4 | Os filtros de espécie, porte e sexo alteram os resultados apresentados. |
| REQ-05 | 1.4.5 | O usuário adiciona e remove um pet dos favoritos. |
| REQ-06 | 1.4.6 | Ao selecionar um pet, a aplicação apresenta seus dados e história. |
| REQ-07 | 1.4.6 | A página de detalhes apresenta energia, espaço, convivência com crianças e com outros pets. |
| REQ-08 | 1.5.1–1.5.2 | O usuário visualiza e altera os dados do perfil. |
| REQ-09 | 1.5.3–1.5.4 | A aplicação compara o perfil com as características do pet e gera resultado. |
| REQ-10 | 1.5.4 | O resultado apresenta percentual e classificação Alta, Média ou Baixa. |
| REQ-11 | 1.5.5 | Os critérios são divididos entre pontos que combinam e pontos de atenção. |
| REQ-12 | 1.6 | O usuário preenche as perguntas referentes à adoção. |
| REQ-13 | 1.6.7 | O envio é bloqueado quando os critérios mínimos de validação não são atendidos. |
| REQ-14 | 1.7.1 | Um questionário válido cria uma nova solicitação. |
| REQ-15 | 1.7.2 | A aplicação mostra o identificador e a organização responsável pela solicitação. |
| REQ-16 | 1.7.3 | As solicitações aparecem na página “Minhas solicitações”. |
| REQ-17 | 1.7.4 | Cada solicitação apresenta seu status por meio de um indicador visual. |
| REQ-18 | 1.7.5 | Solicitações com status diferente de Cancelada ou Recusada podem ser canceladas; o status passa a Cancelada. |
| REQ-19 | 1.5.2 | O usuário altera os campos do próprio perfil. |
| REQ-20 | 1.5.3–1.5.4 | Alterações salvas no perfil são utilizadas no cálculo seguinte. |

---

# 5. Processo de elaboração do cronograma

O cronograma foi elaborado a partir da EAP, considerando dependências entre atividades, disponibilidade da equipe e o prazo definido pelo patrocinador. A unidade de acompanhamento é a **semana**; o esforço é medido em **horas-pessoa**.

## 5.1 Marcos

| Marco | Descrição | Data prevista |
| ----- | --------- | ------------- |
| M1 | Escopo, requisitos e estrutura inicial aprovados | 11/09/2026 (S2) |
| M2 | Base React, rotas e componentes principais funcionando | 25/09/2026 (S4) |
| M3 | Catálogo e detalhes dos pets concluídos | 09/10/2026 (S6) |
| M4 | Perfil e compatibilidade concluídos | 16/10/2026 (S7) |
| M5 | Questionário e solicitações concluídos | 23/10/2026 (S8) |
| M6 | Testes, correções e demonstração final | 30/10/2026 (S9) |

## 5.2 Atividades do produto

| ID | Atividade / saída verificável | Pred. | Janela | Duração | Datas | Esforço | Responsável |
| -- | ----------------------------- | ----- | ------ | ------- | ----- | ------: | ----------- |
| D01 | Detalhar escopo, fluxo e critérios de aceite | — | S1 | 1 sem. | 01/09 a 03/09 | 12 h | Igor Pereira |
| D02 | Definir dados e entidades do protótipo | D01 | S1–S2 | 2 sem. | 04/09 a 11/09 | 10 h | Igor Pereira |
| D03 | Estruturar aplicação React + TypeScript | D01 | S2 | 1 sem. | 07/09 a 11/09 | 8 h | Marcos Vinícius Silvestre |
| D04 | Configurar rotas | D03 | S2–S3 | 2 sem. | 10/09 a 18/09 | 8 h | Marcos Vinícius Silvestre |
| D05 | Desenvolver componentes compartilhados | D03 | S2–S4 | 3 sem. | 10/09 a 25/09 | 20 h | Marcos Vinícius Silvestre |
| D06 | Implementar página inicial | D03 | S3 | 1 sem. | 14/09 a 18/09 | 8 h | Lucas Ferreira |
| D07 | Implementar catálogo, pesquisa e filtros | D04, D05 | S3–S5 | 3 sem. | 17/09 a 02/10 | 18 h | Lucas Ferreira |
| D08 | Implementar cards e favoritos | D05, D07 | S4–S5 | 2 sem. | 21/09 a 02/10 | 10 h | Lucas Ferreira |
| D09 | Implementar detalhes dos pets | D07 | S5–S6 | 2 sem. | 28/09 a 09/10 | 12 h | Lucas Ferreira |
| D10 | Implementar perfil do adotante | D05 | S5–S6 | 2 sem. | 28/09 a 09/10 | 10 h | Marcos Vinícius Silvestre |
| D11 | Implementar cálculo de compatibilidade | D09, D10 | S6–S7 | 2 sem. | 05/10 a 16/10 | 14 h | Marcos Vinícius Silvestre |
| D12 | Implementar questionário e validações | D11 | S7–S8 | 2 sem. | 13/10 a 23/10 | 14 h | Lucas Ferreira |
| D13 | Implementar criação e confirmação da solicitação | D12 | S8 | 1 sem. | 19/10 a 23/10 | 6 h | Lucas Ferreira |
| D14 | Implementar acompanhamento e cancelamento | D13 | S8–S9 | 2 sem. | 20/10 a 27/10 | 6 h | Marcos Vinícius Silvestre |
| D15 | Realizar integração do fluxo completo | D06–D14 | S9 | 1 sem. | 26/10 a 27/10 | 4 h | Marcos Vinícius Silvestre |
| D16 | Testar, corrigir e preparar demonstração | D15 | S9 | 1 sem. | 27/10 a 30/10 | 40 h | Igor Pereira (10 h), Marcos Vinícius Silvestre (15 h), Lucas Ferreira (15 h) |
| | **Subtotal produto** | | | | | **200 h** | |

## 5.3 Atividades de gerenciamento

| ID | Atividade / saída | Pred. | Janela | Período | Esforço | Responsável |
| -- | ----------------- | ----- | ------ | ------- | ------: | ----------- |
| G01 | Consolidar plano do projeto | — | S1 | 01/09 a 04/09 | 6 h | Igor Pereira |
| G02 | Validar escopo e EAP | G01 | S2 | 07/09 a 11/09 | 3 h | Igor Pereira + equipe |
| G03 | Acompanhar requisitos e mudanças | G02 | S2–S9 | 07/09 a 30/10 | 4 h | Igor Pereira |
| G04 | Atualizar cronograma | G02 | S2–S9 | 07/09 a 30/10 | 4 h | Igor Pereira |
| G05 | Monitorar riscos | G01 | S1–S9 | 01/09 a 30/10 | 4 h | Igor Pereira |
| G06 | Acompanhar qualidade e testes | D06 | S3–S9 | 14/09 a 30/10 | 3 h | Igor Pereira |
| G07 | Consolidar documentação | D01 | S1–S9 | 01/09 a 30/10 | 16 h | Igor Pereira |
| G08 | Preparar demonstração e aceite | D16 | S9 | 28/10 a 30/10 | 8 h | Igor Pereira + equipe |
| G09 | Elaborar encerramento e lições aprendidas | G08 | S9 | 28/10 a 30/10 | 8 h | Igor Pereira |
| | **Subtotal gerenciamento e documentação** | | | | **56 h** | |

**Esforço total planejado: 256 h** (desenvolvimento 160 h, testes 40 h, gestão 32 h, documentação 24 h).

## 5.4 Critério de atualização do cronograma

O progresso será acompanhado por atividades concluídas, esforço realizado, esforço restante, entregas aceitas, defeitos encontrados, riscos ativos e previsão de término. A linha de base somente será alterada mediante controle de mudanças.

Uma variação superior a **10% do esforço previsto de uma atividade**, um atraso que comprometa um marco ou uma mudança relevante de escopo será analisada pelo gerente do projeto e, quando afetar marcos ou orçamento, levada ao patrocinador.

## 5.5 Calendário das semanas

| Semana | Período |
| ------ | ------- |
| S1 | 01/09 a 04/09 |
| S2 | 07/09 a 11/09 |
| S3 | 14/09 a 18/09 |
| S4 | 21/09 a 25/09 |
| S5 | 28/09 a 02/10 |
| S6 | 05/10 a 09/10 |
| S7 | 13/10 a 16/10 |
| S8 | 19/10 a 23/10 |
| S9 | 26/10 a 30/10 |

---

# 6. Recursos e orçamento

## 6.1 Recursos humanos

A equipe é composta por três integrantes, que acumulam funções.

| Integrante | Papéis | Responsabilidades |
| ---------- | ------ | ----------------- |
| Igor Pereira | Gerente do projeto; analista de requisitos e UX; responsável por documentação | Planejamento, acompanhamento, escopo, riscos, comunicação, levantamento do fluxo, requisitos, regras de compatibilidade, dados simulados, documentação, demonstração e encerramento |
| Marcos Vinícius Silvestre | Desenvolvedor frontend sênior (responsável técnico) | Base técnica, rotas, componentes compartilhados, perfil, compatibilidade, acompanhamento e cancelamento, integração, revisão de código e testes |
| Lucas Ferreira | Desenvolvedor frontend; responsável por testes | Página inicial, catálogo, favoritos, detalhes, questionário, solicitação, plano e execução de testes e registro de defeitos |

**Distribuição de esforço previsto**

| Componente | Horas |
| ---------- | ----: |
| Desenvolvimento (inclui requisitos e UX) | 160 h |
| Testes | 40 h |
| Gestão | 32 h |
| Documentação | 24 h |
| **Total** | **256 h** |

A carga é de cerca de 85 horas por integrante ao longo das 9 semanas (aproximadamente 9 a 10 horas semanais), compatível com a dedicação parcial da equipe: Igor Pereira 88 h, Marcos Vinícius Silvestre 85 h e Lucas Ferreira 83 h.

## 6.2 Recursos tecnológicos

| Recurso | Utilização |
| ------- | ---------- |
| React | Desenvolvimento da interface |
| TypeScript | Tipagem e desenvolvimento |
| React Router | Navegação entre páginas |
| Lucide React | Ícones da interface |
| Git/GitHub | Controle de versão |
| Editor/IDE | Desenvolvimento |
| Navegador web | Execução e testes |
| Dados locais | Simulação das informações do sistema |
| Ferramenta de gestão de tarefas e prototipação | Quadro de atividades e rascunhos de telas |

## 6.3 Fazer ou comprar

O produto será **desenvolvido pela equipe**. Não serão adquiridos: sistema de adoção pronto, banco de dados, API comercial, serviço de autenticação, hospedagem obrigatória para o protótipo ou sistema administrativo de organizações. As bibliotecas do frontend são dependências técnicas e não representam aquisição de um sistema pronto.

## 6.4 Orçamento e linha de base de custos

O orçamento representa o **valor econômico estimado das horas da equipe**, calculado com taxa-hora de referência de **R$ 50,00**. O desembolso direto previsto limita-se a ferramentas e serviços de apoio (R$ 500,00).

| Componente | Horas | Taxa-hora | Custo |
| ---------- | ----: | --------: | ----: |
| Desenvolvimento | 160 h | R$ 50,00 | R$ 8.000,00 |
| Gestão | 32 h | R$ 50,00 | R$ 1.600,00 |
| Testes | 40 h | R$ 50,00 | R$ 2.000,00 |
| Documentação | 24 h | R$ 50,00 | R$ 1.200,00 |
| Ferramentas e serviços de apoio | — | — | R$ 500,00 |
| Reserva de contingência (10% do subtotal) | — | — | R$ 1.330,00 |
| **Total** | **256 h** | — | **R$ 14.630,00** |

O subtotal antes da reserva é de R$ 13.300,00. A reserva de contingência só poderá ser utilizada mediante aprovação do patrocinador.

**Distribuição do valor econômico por integrante:**

| Integrante | Horas | Custo |
| ---------- | ----: | ----: |
| Igor Pereira | 88 h | R$ 4.400,00 |
| Marcos Vinícius Silvestre | 85 h | R$ 4.250,00 |
| Lucas Ferreira | 83 h | R$ 4.150,00 |
| **Subtotal de horas** | **256 h** | **R$ 12.800,00** |

---

# 7. Plano de engajamento das partes interessadas

## 7.1 Partes interessadas

| Stakeholder | Poder | Interesse | Impacto | Estratégia |
| ----------- | ----- | --------- | ------- | ---------- |
| Patrocinador (Diretor de Produto — AdotaPet) | Alto | Alto | Alto | Gerenciar de perto |
| Gerente do projeto (Igor Pereira) | Alto | Alto | Alto | Gerenciar de perto |
| Equipe de desenvolvimento (Marcos Vinícius Silvestre e Lucas Ferreira) | Alto | Alto | Alto | Gerenciar de perto |
| Usuário/adotante potencial | Baixo | Alto | Médio | Manter informado |
| Organizações de proteção animal | Baixo nesta etapa | Médio | Futuro | Manter informadas somente quando aplicável |
| Administradores de uma futura versão | Baixo nesta etapa | Médio | Futuro | Registrar necessidades futuras |

As organizações exibidas no protótipo são dados de demonstração e não participam do desenvolvimento.

## 7.2 Matriz de engajamento

| Stakeholder | Atual | Desejado |
| ----------- | ----- | -------- |
| Patrocinador | Neutro | Líder |
| Gerente do projeto (Igor Pereira) | Apoiador | Líder |
| Equipe de desenvolvimento (Marcos Vinícius Silvestre e Lucas Ferreira) | Apoiador | Líder na execução técnica |
| Usuários potenciais | Neutro | Apoiador |
| Organizações externas | Neutro | Neutro nesta etapa |

## 7.3 Plano de engajamento

| Stakeholder | Objetivo | Ação | Frequência | Responsável |
| ----------- | -------- | ---- | ---------- | ----------- |
| Patrocinador | Validar decisões importantes | Demonstrações e apresentação dos marcos | Em cada marco (M1 a M6) | Igor Pereira |
| Equipe | Garantir alinhamento | Reunião semanal e atualização das tarefas | Semanal (segundas-feiras, 30 min) | Igor Pereira |
| Desenvolvedores | Garantir execução técnica | Revisão de código e acompanhamento | Contínuo | Marcos Vinícius Silvestre |
| Usuários potenciais | Verificar compreensão do fluxo | Demonstração do protótipo | M3, M5 e M6 | Equipe |
| Organizações | Registrar possíveis necessidades futuras | Backlog e documentação | Quando aplicável | Igor Pereira |

---

# 8. Plano de controle do projeto

## 8.1 Controle de escopo

O escopo é controlado por comparação entre a EAP aprovada, os requisitos, os critérios de aceite, as funcionalidades implementadas e as solicitações de mudança. Qualquer funcionalidade não prevista na EAP é analisada antes de ser adicionada.

**Processo de mudança:**

1. registrar a solicitação;
2. identificar requisito ou entrega afetada;
3. avaliar impacto em prazo;
4. avaliar impacto em esforço e custo;
5. avaliar impacto em qualidade;
6. avaliar impacto no restante do escopo;
7. aprovar ou rejeitar (alterações com impacto em marcos ou orçamento são aprovadas pelo patrocinador);
8. atualizar a linha de base quando necessário.

## 8.2 Controle de prazo

O cronograma é atualizado semanalmente, observando atividades atrasadas e bloqueadas, dependências, marcos, esforço restante e previsão de término.

## 8.3 Controle de recursos

A equipe é acompanhada quanto a disponibilidade, distribuição de tarefas, carga individual e tarefas críticas. Nenhum integrante concentra sozinho uma atividade que possa bloquear o projeto inteiro; Marcos Vinícius Silvestre e Lucas Ferreira revisam o código um do outro.

## 8.4 Controle de custos

O custo realizado é calculado a partir das horas efetivamente registradas multiplicadas pela taxa-hora de referência (R$ 50,00), comparado à linha de base de R$ 14.630,00. O desembolso direto é limitado a R$ 500,00, salvo aprovação posterior do patrocinador.

---

# 9. Gerenciamento de riscos

## 9.1 Escala

**Probabilidade:** baixa (até 25%); média (26% a 50%); alta (acima de 50%).

**Impacto:** baixo (até 8 horas); médio (9 a 16 horas); alto (17 horas ou mais).

A prioridade resulta da combinação entre probabilidade e impacto.

## 9.2 Registro de riscos

| ID | Risco | Prob. | Impacto | Prioridade | Mitigação | Contingência | Responsável |
| -- | ----- | ----- | ------- | ---------- | --------- | ------------ | ----------- |
| RT01 | Dificuldade da equipe em React/TypeScript ou em alguma biblioteca. | Média (35%) | Alto (20 h) | Alta | Desenvolvimento incremental, pesquisa e revisão entre integrantes. | Simplificar funcionalidades secundárias e priorizar o fluxo principal. | Marcos Vinícius Silvestre |
| RT02 | Mudanças de escopo provocarem retrabalho. | Média (30%) | Médio (12 h) | Média | Controle formal de mudanças. | Adiar funcionalidades não essenciais. | Igor Pereira |
| RT03 | Erros no cálculo de compatibilidade. | Média (35%) | Alto (18 h) | Alta | Criar casos de teste para cada uma das seis regras. | Corrigir a regra e executar regressão. | Lucas Ferreira |
| RT04 | Defeitos no formulário impedirem o envio da solicitação. | Média (30%) | Médio (12 h) | Média | Validar cada campo individualmente. | Corrigir validação e repetir o fluxo completo. | Lucas Ferreira |
| RT05 | Integração entre componentes provocar comportamento inconsistente. | Média (30%) | Médio (14 h) | Média | Testes de integração e revisão de código. | Reverter alteração e integrar novamente de forma incremental. | Marcos Vinícius Silvestre |
| RT06 | Dados simulados não representarem os cenários necessários. | Baixa (15%) | Médio (10 h) | Baixa | Criar diferentes perfis e pets de teste. | Acrescentar dados fictícios necessários. | Igor Pereira |
| RT07 | Perda ou conflito de código no Git. | Média (30%) | Alto (17 h) | Alta | Commits frequentes e branches organizadas. | Recuperar versão anterior e reaplicar alterações. | Marcos Vinícius Silvestre |
| RT08 | Prazo insuficiente para acabamento visual. | Média (40%) | Médio (10 h) | Média | Priorizar requisitos funcionais. | Reduzir melhorias estéticas não essenciais. | Igor Pereira |
| RT09 | Funcionalidades serem interpretadas como funcionalidades reais de adoção. | Baixa (20%) | Alto (17 h) | Média | Identificar o projeto como protótipo em toda a documentação. | Reforçar limitações na documentação e na demonstração. | Igor Pereira |
| RT10 | Ausência de backend limitar a persistência dos dados. | Alta (100%) | Baixo (4 h) | Média | Declarar a restrição no escopo. | Registrar backend como evolução futura. | Igor Pereira |

## 9.3 Oportunidades

| ID | Oportunidade | Benefício |
| -- | ------------ | --------- |
| OP01 | Reutilização de componentes | Redução de retrabalho |
| OP02 | Tipagem TypeScript | Redução de erros de dados |
| OP03 | Fluxo dividido em etapas | Melhor compreensão do processo |
| OP04 | Dados simulados controlados | Facilita testes e demonstrações |
| OP05 | Arquitetura preparada para evolução | Facilita futura integração com backend |

---

# 10. Plano de qualidade

A qualidade é avaliada pela execução correta das funcionalidades e pela organização técnica do frontend.

## 10.1 Critérios de qualidade funcional

O protótipo deve: permitir navegar pelo fluxo principal; apresentar os pets corretamente; executar pesquisa e filtros; apresentar os detalhes; permitir alterar favoritos; permitir editar o perfil; calcular compatibilidade de forma determinística; validar o questionário; criar solicitações válidas; apresentar confirmação; listar solicitações; e permitir cancelamento quando aplicável.

## 10.2 Critérios de qualidade técnica

* código TypeScript sem erros relevantes;
* componentes reutilizáveis;
* rotas funcionando;
* ausência de erros críticos no console;
* estado atualizado corretamente;
* interface responsiva;
* mensagens de erro compreensíveis;
* uso adequado de elementos semânticos e rótulos de acessibilidade;
* revisão de código entre os desenvolvedores;
* controle de versão funcionando.

## 10.3 Estratégia de testes

**Pesquisa:** busca por nome, raça e cidade; busca sem resultados; limpeza dos filtros.

**Filtros:** espécie, porte e sexo; combinação de filtros; remoção dos filtros.

**Favoritos:** favoritar; desfavoritar; estado visual; atualização dos cards.

**Compatibilidade:** pet de energia alta com perfil ativo e não ativo; necessidade de área externa; presença de crianças; presença de outros animais; cuidados especiais; experiência do adotante.

O cálculo utiliza seis critérios e transforma a quantidade de critérios atendidos em percentual. A classificação é:

* **Alta:** 80% ou mais (5 ou 6 critérios atendidos);
* **Média:** 55% a 79% (4 critérios);
* **Baixa:** abaixo de 55% (3 critérios ou menos).

A interface informa que o resultado é orientativo e não representa decisão automática de adoção.

## 10.4 Testes do questionário

Serão verificados: motivação com menos de 20 caracteres; rotina com menos de 20 caracteres; adaptação com menos de 15 caracteres; custos não confirmados; compromisso não confirmado; formulário válido; criação da solicitação após a validação.

## 10.5 Teste do fluxo completo

```text
Início
  ↓
Encontrar pets
  ↓
Selecionar pet
  ↓
Ver detalhes
  ↓
Ver compatibilidade
  ↓
Preencher questionário
  ↓
Enviar solicitação
  ↓
Confirmar solicitação
  ↓
Acompanhar solicitação
  ↓
Cancelar solicitação, se permitido
```

O teste do fluxo completo será executado entre 27/10 e 29/10/2026 (atividade D16), com os defeitos críticos corrigidos antes da demonstração de 30/10/2026.

---

# 11. Plano de comunicação

## 11.1 Cadência

| Comunicação | Público | Canal | Frequência | Responsável |
| ----------- | ------- | ----- | ---------- | ----------- |
| Reunião da equipe | Equipe | Reunião/chat | Semanal (segundas-feiras) | Igor Pereira |
| Atualização de tarefas | Equipe | Quadro/repositório | Contínua | Todos |
| Registro de decisões | Equipe e patrocinador | Documento/repositório | Quando necessário | Igor Pereira |
| Demonstração | Patrocinador e equipe | Apresentação | Marcos M3, M5 e M6 | Igor Pereira + equipe |
| Relatório de progresso | Patrocinador | Documento | Quinzenal (18/09, 02/10, 16/10, 30/10) | Igor Pereira |
| Registro de riscos | Equipe | Documento | Semanal | Igor Pereira |
| Aceite | Patrocinador e equipe | Documento/apresentação | Marcos | Patrocinador |

## 11.2 Informações mínimas do acompanhamento

Cada atualização indica: o que foi concluído; o que está em andamento; o que está atrasado; riscos; impedimentos; decisões necessárias; alterações de escopo; e previsão para o próximo marco.

---

# 12. Responsabilidades, aceite e encerramento

## 12.1 Matriz de responsabilidades

| Entrega | A — aprovação | R — execução |
| ------- | ------------- | ------------ |
| 1.1 Gestão | Igor Pereira | Igor Pereira |
| 1.2 Requisitos | Igor Pereira | Igor Pereira |
| 1.3 Base técnica | Marcos Vinícius Silvestre | Marcos Vinícius Silvestre |
| 1.4 Descoberta de pets | Marcos Vinícius Silvestre | Lucas Ferreira |
| 1.5 Perfil e compatibilidade | Igor Pereira | Marcos Vinícius Silvestre |
| 1.6 Questionário | Igor Pereira | Lucas Ferreira |
| 1.7 Solicitações | Marcos Vinícius Silvestre | Lucas Ferreira e Marcos Vinícius Silvestre |
| 1.8 Componentes | Marcos Vinícius Silvestre | Marcos Vinícius Silvestre e Lucas Ferreira |
| 1.9 Testes e encerramento | Igor Pereira | Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira |

**A — Accountable:** responsável por garantir que a entrega seja concluída e aceita. **R — Responsible:** responsável pela execução.

O patrocinador não executa atividades técnicas, mas aprova marcos e alterações relevantes de escopo, prazo ou orçamento.

## 12.2 Critérios de aceite do produto

O protótipo do AdotaPet será considerado concluído quando todos os itens abaixo forem verificados na demonstração final (30/10/2026):

* [ ] página inicial funcionando (REQ-01);
* [ ] catálogo funcionando (REQ-02);
* [ ] pesquisa e filtros funcionando (REQ-03, REQ-04);
* [ ] favoritos funcionando (REQ-05);
* [ ] detalhes dos pets funcionando (REQ-06, REQ-07);
* [ ] perfil e edição do perfil funcionando (REQ-08, REQ-19);
* [ ] compatibilidade funcionando (REQ-09 a REQ-11, REQ-20);
* [ ] questionário e validação funcionando (REQ-12, REQ-13);
* [ ] criação da solicitação e confirmação funcionando (REQ-14, REQ-15);
* [ ] acompanhamento e cancelamento funcionando (REQ-16 a REQ-18);
* [ ] navegação entre as etapas funcionando (RNF-02);
* [ ] fluxo completo testado e defeitos críticos corrigidos (seção 10.5);
* [ ] documentação entregue e demonstração realizada;
* [ ] limitações do protótipo documentadas (seção 12.3).

---

## 12.3 Limitações conhecidas

A entrega não é um sistema de adoção real. O protótipo não possui persistência, backend, banco de dados, autenticação, integração com organizações, comunicação externa, decisão automática de adoção, publicação real de animais ou aprovação real de solicitações.

As solicitações são mantidas no estado da aplicação e criadas pelo frontend durante a execução. O cálculo de compatibilidade é orientativo: compara o perfil com as necessidades do animal, e a decisão final continua sendo da organização responsável.

## 12.4 Encerramento do projeto

O encerramento ocorrerá entre 28/10 e 30/10/2026, após:

1. conclusão das funcionalidades previstas;
2. execução dos testes;
3. correção dos defeitos críticos;
4. demonstração do fluxo completo;
5. aceite do produto pelo patrocinador;
6. atualização da documentação;
7. registro das limitações;
8. registro das lições aprendidas;
9. identificação de melhorias futuras;
10. arquivamento da versão final do projeto.

## 12.5 Lições aprendidas

Ao final serão registrados: dificuldades de desenvolvimento e de integração; decisões técnicas importantes; problemas de comunicação; alterações de escopo; riscos que ocorreram; estratégias que funcionaram e que devem ser evitadas; e melhorias para projetos futuros.

## 12.6 Evoluções futuras

Itens de backlog, fora da linha de base desta versão: backend; banco de dados; autenticação; cadastro real de usuários; cadastro de pets; painel administrativo para organizações; persistência das solicitações; notificações; comunicação entre adotante e organização; agendamento de visitas; integração com localização; recomendação mais avançada de pets; sistema de avaliações; aplicação mobile; publicação em produção.

---

# Linha de base resumida

| Área | Linha de base |
| ---- | ------------- |
| Produto | Protótipo frontend AdotaPet |
| Tecnologia | React + TypeScript |
| Navegação | React Router |
| Dados | Locais/simulados |
| Backend, banco de dados, autenticação | Fora do escopo |
| Fluxo principal | Conhecer → Compatibilidade → Questionário → Solicitação |
| Funcionalidades | Catálogo, pesquisa/filtros, favoritos, perfil, compatibilidade, questionário, solicitações, acompanhamento e cancelamento |
| Prazo | 01/09/2026 a 30/10/2026 (9 semanas) |
| Equipe | 3 integrantes (Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira) |
| Esforço | 256 horas-pessoa |
| Orçamento (valor econômico) | R$ 14.630,00, incluindo reserva de contingência de R$ 1.330,00 |
| Desembolso direto previsto | R$ 500,00 (ferramentas e serviços de apoio) |
| Patrocinador | Diretor de Produto — AdotaPet |

---

# Aprovação

| Papel | Nome | Data | Assinatura/aceite |
| ----- | ---- | ---- | ----------------- |
| Gerente do projeto | Igor Pereira | 02/09/2026 | Aprovado e assinado |
| Responsável técnico | Marcos Vinícius Silvestre | 02/09/2026 | Aprovado e assinado |
| Patrocinador | Diretor de Produto — AdotaPet | 02/09/2026 | Aprovado e assinado |

**Versão aprovada:** 1.0

**Data de aprovação:** 02/09/2026
