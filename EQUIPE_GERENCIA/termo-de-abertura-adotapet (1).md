# Termo de Abertura do Projeto

## AdotaPet — Sistema de Adoção de Pets

| Campo                  | Informação                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Versão**             | 1.0                                                                                                                             |
| **Data**               | 05/10/2026                                                                                                                      |
| **Patrocinador**       | Prof. Diogo Mendonça                                                                                                            |
| **Gerente do projeto** | Pedro Pimentel Nunes                                                                                                            |
| **Equipe de gestão**   | Ana Isabel Matias da Silva Basilio; Beatriz Cardoso Abdias; Pedro Pimentel Nunes; Tamires Barbosa dos Santos                    |
| **Duração estimada**   | 12 semanas letivas efetivas, de 03/08 a 30/11/2026 (aprox. 4 meses de calendário, incluindo semanas sem aula)                    |
| **Equipe prevista**    | 7 alunos: 3 da disciplina de Programação Web (PSW) e 4 da disciplina de GPTI; disponibilidade máxima planejada de até 5 horas semanais por pessoa |

## 1. Propósito e justificativa

O presente documento autoriza o início de um projeto acadêmico para desenvolver o AdotaPet, sistema de adoção de animais. A proposta parte da hipótese de que informações dispersas em redes sociais, grupos de mensagens e outros canais dificultam que interessados encontrem pets e comparem opções, e que responsáveis organizem e acompanhem solicitações. O AdotaPet pretende concentrar informações e estruturar esses fluxos em uma plataforma digital. Essa hipótese ainda não foi validada por pesquisa de campo com adotantes, responsáveis ou organizações.

O projeto será também uma experiência de aprendizagem prática nas disciplinas de Programação Web (PSW) e Gerência de Projetos de TI (GPTI). Participam sete alunos, com disponibilidade máxima planejada de até cinco horas semanais por pessoa; o esforço efetivo é estimado por atividade no Plano do Projeto e pode ser inferior a esse limite. Três alunos de PSW — Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira — serão responsáveis por construir o produto, e quatro alunos de GPTI conduzirão a gestão do projeto e validarão o escopo. A gerência ficará a cargo de Pedro Pimentel Nunes, junto à equipe de gestão formada por Ana Isabel Matias da Silva Basilio, Beatriz Cardoso Abdias, Pedro Pimentel Nunes e Tamires Barbosa dos Santos; o patrocinador é o Prof. Diogo Mendonça. A solução será desenvolvida com React e TypeScript no frontend e JavaScript, Express e MongoDB no backend. O grupo de PSW aplicará conhecimentos de desenvolvimento web na construção do sistema, enquanto GPTI aplicará planejamento, acompanhamento, controle de escopo e validação. Por ser uma atividade acadêmica, o planejamento deve apoiar o aprendizado e organizar entregas compatíveis com 12 semanas letivas efetivas distribuídas entre agosto e novembro de 2026.

O AdotaPet deverá apoiar o ciclo de adoção desde a divulgação e busca de pets até o acompanhamento das solicitações e a conclusão da adoção. O escopo e as regras de negócio serão definidos com base na especificação inicial e nos casos de uso; a validação deste projeto é acadêmica e interna.

## 2. Objetivos do projeto

Os objetivos abaixo descrevem os resultados esperados para o projeto. A equipe de GPTI acompanhará o atendimento dos critérios e registrará os aceites dos marcos, com ciência do patrocinador. O impacto de larga escala, como a otimização de fluxos externos em abrigos ou redes de apoio, é uma hipótese futura, não um critério de sucesso deste projeto acadêmico.

- Jornada do Adotante: O usuário consegue pesquisar e filtrar pets, consultar detalhes e compatibilidade, preencher o questionário e enviar, acompanhar ou cancelar uma solicitação conforme as regras definidas.

- Perfil e acompanhamento: O usuário consegue manter o perfil utilizado no cálculo de compatibilidade, favoritar pets, consultar suas solicitações e cancelar uma solicitação quando permitido pelo fluxo implementado.

- Jornada do Responsável: O responsável consegue cadastrar, consultar, atualizar e remover pets sob sua responsabilidade; consultar solicitações recebidas; aprovar ou recusar solicitações elegíveis; e registrar a conclusão da adoção conforme as regras definidas para o projeto.

- Gestão de usuários: Os fluxos de cadastro, consulta, atualização e exclusão de usuários previstos nos casos de uso serão implementados com identidades fictícias e permissões por papel; o fluxo OAuth será mockado.

- Critério de sucesso: Demonstrar os 17 casos de uso previstos e os cenários de aceite definidos para os marcos, com dados fictícios persistidos no MongoDB, validações, autorização e erros tratados; registrar resultados, limitações e lições aprendidas.

## 3. Escopo de alto nível

### Incluído

- Levantamento e validação das regras necessárias aos fluxos de adoção previstos para o projeto.
- Interface frontend em React e TypeScript para apresentação, pesquisa, filtragem e consulta de pets, perfil do adotante, compatibilidade, questionário, solicitações e favoritos.
- Backend próprio em Node.js com Express, regras de negócio e persistência em MongoDB, integrado ao frontend.
- Endpoints de demonstração explicitamente identificados no contrato mantidos no `json-server`, além do fluxo OAuth mockado com identidades fictícias e sem conexão com provedores externos.
- Persistência no MongoDB de dados fictícios de usuários, pets, perfis, favoritos, solicitações e adoções; os dados serão consultados e alterados pelo frontend exclusivamente por APIs.
- Implementação dos 17 casos de uso: cadastrar, consultar, atualizar e excluir usuário; cadastrar, consultar, atualizar e excluir pet; pesquisar pets; filtrar pets; visualizar detalhes do pet; solicitar adoção; consultar solicitações; aprovar solicitação; recusar solicitação; cancelar solicitação; e finalizar adoção.
- Implementação dos fluxos complementares do adotante definidos no Plano do Projeto, incluindo perfil, favoritos, compatibilidade, questionário, ordenação e paginação.
- Testes funcionais e de contrato, documentação essencial e demonstrações dos marcos do projeto.

### Fora do escopo

- Integração efetiva com provedores externos de identidade, incluindo OAuth/OIDC federado e SSO; o fluxo OAuth incluído no projeto é apenas um mock acadêmico.
- Uso de credenciais ou dados pessoais reais.
- Integração com sistemas externos, bases de dados de organizações ou outros serviços de terceiros.
- Implantação e operação do sistema em ambiente de produção.
- Funcionalidades que não estejam contempladas nos casos de uso definidos para o projeto.
- Alterações nas regras de negócio após a validação do escopo, sem o devido processo de mudança.
- Funcionalidades adicionais necessárias a uma futura utilização real, como recuperação de senha por serviço externo, verificação externa de e-mail e MFA.

## 4. Abordagem técnica e de aprendizagem

O desenvolvimento será incremental, com serviços simulados apoiando a construção e validação dos fluxos antes e durante a integração:

1. **Frontend:** React e TypeScript com Vite, consumindo APIs REST por meio dos hooks e do cliente HTTP da aplicação.

2. **Backend e persistência:** API REST em Node.js com Express, responsável pela validação, autorização, regras de negócio e operações de usuários, pets, perfis, favoritos, solicitações e adoções; persistência em MongoDB. O frontend acessa os dados por meio da API e não se conecta diretamente ao banco.

3. **Serviços simulados:** as rotas que permanecerão no `json-server` serão identificadas por endpoint e contrato no Plano do Projeto; os demais fluxos de negócio serão atendidos pela API Express/MongoDB. OAuth será mockado com identidades fictícias. Nenhum mock se conectará a serviços externos ou utilizará credenciais reais.

Como a equipe está em processo de aprendizagem das tecnologias, o planejamento deverá reservar tempo para capacitação, pareamento, revisão de código e correção de defeitos. Os alunos de PSW praticarão a construção e integração dos componentes; os alunos de GPTI planejarão e acompanharão as atividades, controlarão o escopo e validarão as entregas. A equipe priorizará os fluxos essenciais para compatibilizar o trabalho com a disponibilidade máxima de até cinco horas por semana e o horizonte de 12 semanas letivas, de 03/08 a 30/11/2026.

## 5. Marcos e entregas

| **Marco**                                                         | **Prazo previsto** | **Entregáveis e critérios de aceite preliminares**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1 — Frontend dos fluxos prioritários com serviços simulados** | Semana letiva 8: GPTI 05/10/2026; PSW 06/10/2026 | Termo de Abertura, Caso de Negócio e Plano de Projeto; busca e filtros, detalhe do pet, compatibilidade, perfil, favoritos e questionário com envio de solicitação demonstráveis no frontend; dados fornecidos pelos mocks documentados e OAuth demonstrado com identidade fictícia. A equipe de GPTI registra o aceite ou os critérios pendentes, com ciência do patrocinador. |
| **M2 — Sistema integrado ao backend próprio** | Semana letiva 12: PSW 10/11/2026; aceite GPTI 30/11/2026 | Frontend conectado à API Express e aos dados fictícios persistidos em MongoDB; os 17 casos de uso e os fluxos complementares aprovados no Plano do Projeto demonstrados conforme seus critérios de aceite, incluindo solicitação pelo adotante, decisão pelo responsável e atualização da disponibilidade do pet após a conclusão da adoção; testes dos fluxos e erros, documentação e demonstração final. As rotas mantidas no `json-server` estarão listadas no contrato, e OAuth continuará mockado, sem conexão com provedor externo. A equipe de GPTI registra o aceite ou os critérios pendentes, com ciência do patrocinador. |

A definição dos marcos considera o cronograma revisado: as atividades práticas realizadas em **28/09 e 29/09** não entram na contagem das semanas de desenvolvimento, deslocando os marcos em uma semana letiva. O horizonte é de 12 semanas letivas efetivas entre **03/08 e 30/11/2026**; semanas sem aula não acrescentam esforço, mas ampliam o intervalo de calendário. A AV1 ocorre na semana 8 e o aceite do M2 na semana 12. As datas e os critérios detalhados de aceite seguem a linha de base do cronograma e o Plano do Projeto.

O detalhamento dos pacotes de trabalho e dos respectivos critérios de aceite está no [Dicionário da EAP](./dicionario-eap-adotapet.md), alinhado à EAP e ao cronograma do [Plano do Projeto](./plano-de-projeto-adotapet%20(2).md).

## 6. Requisitos de alto nível e critérios gerais de sucesso

Os requisitos de alto nível representam os principais comportamentos esperados do AdotaPet e servirão como referência para avaliar o produto e os marcos previstos.

- **Acesso e identidade:** o sistema deverá oferecer os fluxos de acesso definidos para os papéis do projeto. OAuth será demonstrado por mock com identidades fictícias, sem autenticação federada ou conexão com provedor externo.

- **Consulta e gestão de pets:** o adotante deverá conseguir pesquisar, filtrar e consultar detalhes dos pets disponíveis; o responsável deverá cadastrar, consultar, atualizar e remover os pets sob sua responsabilidade.

- **Perfil e favoritos:** o usuário deverá conseguir editar o perfil utilizado na compatibilidade e gerenciar seus pets favoritos.

- **Solicitação de adoção:** o interessado deverá conseguir preencher o questionário, enviar uma solicitação, consultar suas solicitações e cancelá-las quando permitido. O responsável deverá conseguir consultar e analisar as solicitações e aprovar ou recusar as elegíveis, conforme as regras definidas para o projeto.

- **Decisão e conclusão da adoção:** o sistema deverá registrar a aprovação ou recusa pelo responsável e, quando uma adoção for concluída, atualizar o vínculo e a disponibilidade do pet conforme as regras do projeto.

- **Dados e serviços:** serão usados dados fictícios persistidos no MongoDB. A API Express fornecerá os dados e persistência dos fluxos de negócio; qualquer rota que permaneça no `json-server` será identificada no contrato e no Plano do Projeto. O frontend não se conectará diretamente ao banco.

- **Critério geral de sucesso:** demonstrar os fluxos prioritários de adoção de ponta a ponta, com persistência, validação e tratamento dos principais erros; obter o aceite interno de cada marco e registrar eventuais limitações e lições aprendidas. Não serão atribuídas ao projeto métricas de adoção ou resultados sociais que não tenham sido previamente estabelecidos.

### Critérios de encerramento e cancelamento

O encerramento do projeto está previsto para a **semana letiva 12**, com aceite GPTI em 30/11/2026. A equipe de GPTI registrará o aceite do M2 ou os critérios não atendidos, além das pendências e lições aprendidas; o patrocinador dará ciência do encerramento. Encerrar com limitações registradas é preferível a omitir critérios que não foram alcançados.

O projeto poderá ser replanejado ou encerrado antes do M2 caso o patrocinador retire a autorização, recursos essenciais deixem de estar disponíveis ou uma mudança necessária torne inviável a conclusão no prazo e não seja possível reduzir ou reorganizar o escopo. As decisões de interrupção ou cancelamento serão registradas e comunicadas à equipe.

Os critérios acadêmicos adicionais para cancelamento seguirão as orientações da disciplina.

## 7. Premissas e restrições

### Premissas

- O projeto será desenvolvido por sete alunos, sendo três de PSW e quatro de GPTI, com disponibilidade máxima de até cinco horas semanais por participante e horizonte de 12 semanas letivas efetivas, entre 03/08 e 30/11/2026. O esforço planejado pode ser inferior ao limite e é distribuído pelas atividades no Plano do Projeto.

- Os alunos de PSW serão responsáveis pelo desenvolvimento do produto, enquanto os alunos de GPTI acompanharão o planejamento, a organização das atividades, o controle do escopo e a validação das entregas.

- O Prof. Diogo Mendonça será o patrocinador do projeto e acompanhará as principais entregas e demonstrações previstas.

- A especificação inicial fornecida pela equipe e as 17 operações de caso de uso serão consideradas como a principal referência para o entendimento do domínio, definição do escopo funcional e organização da evolução do AdotaPet.

- A equipe terá acesso às ferramentas, ao repositório e aos recursos necessários para o desenvolvimento do projeto.

- Serão utilizados dados fictícios para cadastros, pets, usuários e solicitações; não se presume fornecimento de dados ou participação de organizações externas.

### Restrições

- O projeto deverá ser concluído até 30/11/2026, considerando o calendário de 12 semanas letivas efetivas e disponibilidade máxima de até cinco horas semanais por participante; semanas sem aula não contam como semanas de esforço.

- A equipe estará em processo de aprendizagem das tecnologias utilizadas no desenvolvimento, o que poderá influenciar a produtividade e exigirá tempo para capacitação, testes e correção de problemas.

- O `json-server` será utilizado apenas para as rotas identificadas como simuladas no contrato e não será tratado como backend de produção ou substituto da API própria em Express/MongoDB.

- O fluxo OAuth será mockado com identidades fictícias. Não serão utilizadas credenciais reais nem haverá integração efetiva com provedores externos.

- O projeto não contempla acesso a sistemas, credenciais, dados ou infraestrutura de terceiros, nem implantação em produção.

- A utilização do sistema em ambiente real dependeria de requisitos adicionais de segurança, privacidade, infraestrutura, operação e aprovação que estão fora do escopo deste projeto acadêmico.

- Alterações relevantes de tecnologia ou arquitetura que possam afetar os marcos previstos deverão ser avaliadas pela equipe antes de serem incorporadas ao projeto.

## 8. Governança e responsabilidades

### Stakeholders

| **Stakeholder**                                   | **Interesse ou responsabilidade**                                                                                                | **Participação no projeto**                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Prof. Diogo Mendonça — patrocinador**           | Apoiar institucionalmente o projeto, acompanhar seu andamento e avaliar decisões que possam alterar seus principais compromissos | Acompanha o desenvolvimento por meio das entregas e apresentações previstas                               |
| **4 alunos de GPTI — Gerência de Projetos de TI** | Organizar o trabalho de gestão, acompanhar o progresso, controlar o escopo e verificar o cumprimento dos marcos estabelecidos    | Atuam diretamente na condução e no acompanhamento do projeto                                              |
| **3 alunos de PSW — Programação Web**             | Transformar o escopo definido em uma solução funcional e desenvolver os componentes necessários para o AdotaPet                  | Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira atuam na construção e evolução do sistema         |
| **Adotantes — usuários interessados**             | Utilizar o sistema para encontrar pets, consultar suas informações e realizar e acompanhar pedidos de adoção                     | Público usuário previsto; não participa diretamente do projeto                                              |
| **Responsáveis por pets**                         | Inserir informações dos animais, administrar seus cadastros e tratar as solicitações de adoção recebidas                         | Perfil de usuário previsto; não participa diretamente do projeto                                           |
| **Organizações de proteção animal**               | Possível utilização do sistema para divulgação e gerenciamento de animais disponíveis para adoção                                | Não precisam participar do projeto; o papel de responsável será demonstrado com identidade e dados fictícios |

Os stakeholders relacionados ao uso do AdotaPet foram identificados a partir da especificação do produto e dos casos de uso. Sua inclusão não significa que tenham participado da elaboração dos requisitos ou aprovado as regras; a validação deste projeto é interna e acadêmica.

### Papéis e responsabilidades

| **Papel**                                     | **Responsabilidades principais**                                                                                                              | **Designação**                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Patrocinador**                              | Apoiar o projeto, acompanhar sua evolução e avaliar alterações que possam impactar escopo ou prazo                                            | Prof. Diogo Mendonça                                                                                         |
| **Gerente do projeto**                        | Conduzir o planejamento, acompanhar a execução e coordenar as atividades relacionadas à gestão do projeto                                     | Pedro Pimentel Nunes                                                                                         |
| **Equipe de gestão (GPTI)**                   | Estruturar o planejamento, acompanhar escopo, prazos, riscos e marcos, além de analisar as entregas realizadas pela equipe de desenvolvimento | Ana Isabel Matias da Silva Basilio; Beatriz Cardoso Abdias; Pedro Pimentel Nunes; Tamires Barbosa dos Santos |
| **Equipe de produto e desenvolvimento (PSW)** | Implementar a solução, desenvolver as funcionalidades priorizadas e participar dos testes e das apresentações do produto                      | Igor Pereira; Marcos Vinícius Silvestre; Lucas Ferreira                                                       |
| **Equipe do projeto**                         | Executar as atividades previstas e contribuir para as entregas dentro da dedicação estabelecida                                               | 7 alunos: 3 de PSW e 4 de GPTI                                                                               |

A equipe de PSW ficará concentrada na implementação do AdotaPet, enquanto a equipe de GPTI será responsável por conduzir e acompanhar os aspectos de gestão do projeto. As avaliações realizadas pela equipe terão caráter acadêmico e interno, não representando validação oficial por organizações de proteção animal ou por outros agentes externos. Alterações que possam modificar significativamente o escopo ou o prazo deverão ser analisadas pela equipe de gestão e encaminhadas ao patrocinador.

## 9. Riscos iniciais e respostas

| **Risco**                                                                                | **Impacto potencial**                                                                                    | **Resposta inicial**                                                                                                                                                       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Atraso na integração entre frontend, API e banco de dados**                           | Integração incompleta, inconsistências de dados ou atraso nos marcos                                        | Definir e documentar contratos, integrar gradualmente e validar os fluxos de ponta a ponta com testes                                                                      |
| **Regras do processo de adoção insuficientemente definidas**                             | Comportamentos diferentes entre as funcionalidades e necessidade de alterações durante o desenvolvimento | Utilizar os casos de uso como referência inicial, identificar as regras ainda não especificadas e registrar as decisões antes da implementação dos fluxos correspondentes  |
| **Divergência entre mocks e contratos da API própria**                                  | Retrabalho ou falhas nos fluxos quando componentes forem integrados                                          | Documentar os contratos dos mocks, validá-los por testes e manter compatibilidade com a API do projeto                                                                   |
| **Amplitude do fluxo de adoção em relação ao prazo disponível**                          | Desenvolvimento incompleto ou comprometimento dos marcos previstos                                       | Priorizar os fluxos essenciais, acompanhar a evolução do escopo e reavaliar prioridades sempre que houver risco de impacto no cronograma                                   |
| **Curva de aprendizagem das tecnologias utilizadas**                                     | Maior tempo para desenvolvimento, correção de erros e possível redução das funcionalidades entregues     | Considerar períodos de estudo e testes no planejamento, acompanhar as dificuldades encontradas e priorizar as funcionalidades essenciais quando necessário                 |
| **Dedicação dos integrantes inferior à estimada**                                        | Acúmulo de atividades, atrasos e necessidade de redistribuição de tarefas                                | Acompanhar a disponibilidade da equipe, distribuir as atividades conforme a capacidade dos integrantes e ajustar prioridades antes dos marcos                              |
| **Dados fictícios interpretados como informações reais sobre pets**                      | Expectativas incorretas sobre disponibilidade, localização ou situação dos animais                       | Identificar os dados como demonstrativos e deixar claro que o sistema não representa anúncios ou informações reais de organizações                                         |
| **Alterações de escopo durante o desenvolvimento**                                       | Retrabalho e comprometimento dos prazos estabelecidos                                                    | Registrar as solicitações de mudança, avaliar seus impactos sobre escopo e cronograma e encaminhar alterações relevantes para decisão do patrocinador                      |
| **Expectativa de utilização real do sistema ao final do projeto**                        | Uso de uma solução acadêmica sem as validações, requisitos e autorizações necessários                    | Comunicar que a entrega corresponde a um protótipo acadêmico e que eventual utilização real dependeria de validações, requisitos adicionais e aprovação dos responsáveis   |



## 10. Estimativa econômica e financiamento

Para a iniciação, considera-se uma estimativa preliminar de ordem de grandeza de **R$ 9.000,00**, calculada sobre a capacidade efetiva de 360 horas-pessoa do calendário do AdotaPet (3 alunos de PSW por 12 semanas e 4 alunos de GPTI por nove semanas, com disponibilidade máxima de cinco horas semanais por pessoa). Aplicando a faixa de incerteza de −25% a +75%, o intervalo preliminar é de **R$ 6.750,00 a R$ 15.750,00**. Essa estimativa considera a capacidade total disponível, não significa que todas as horas serão utilizadas em atividades.

No detalhamento do Plano do Projeto, as atividades somam **216 h** e a contingência identificada soma **56 h**. A linha de base detalhada é de **R$ 6.800,00**, acrescida de reserva gerencial de **R$ 476,00**, totalizando **R$ 7.276,00**. Esse valor menor considera somente o esforço planejado e as reservas aprovadas, não as 88 h de capacidade que permanecem sem atividade ou contingência alocada. Os valores são estimativas simuladas para planejamento, não salários, pagamentos aos estudantes ou desembolsos reais.

A estimativa considera:

- esforço de desenvolvimento do frontend em React e TypeScript;
- desenvolvimento do backend em Node.js com Express, persistência em MongoDB e integração com o frontend;
- atividades de organização e gestão do projeto;
- testes funcionais e validação dos fluxos;
- documentação técnica e preparação das demonstrações;
- reserva de contingência para incertezas relacionadas à curva de aprendizagem da equipe;
- pequena reserva gerencial para absorção de variações não previstas.

Como se trata de um projeto acadêmico, desenvolvido por estudantes no contexto das disciplinas, **não haverá remuneração da equipe**. Portanto, o **desembolso efetivo previsto para pagamento aos participantes é de R$ 0,00**; os valores acima representam apenas uma estimativa econômica do esforço.

Os recursos utilizados são caracterizados como:

- mão de obra acadêmica (alunos de PSW e GPTI);
- ferramentas gratuitas ou já disponíveis (GitHub, bibliotecas e frameworks);
- infraestrutura própria dos participantes (computadores pessoais e ambiente de desenvolvimento).

Não há financiamento externo, contribuição institucional ou orçamento financeiro real solicitado ou aprovado por este termo. Ferramentas e infraestrutura são consideradas disponíveis sem custo adicional para a equipe; eventual necessidade de gasto deverá ser estimada e autorizada antes de ser assumida.

O valor econômico simulado é distribuído igualmente entre os dois marcos para fins de apresentação do orçamento:

| **Marco e gatilho da parcela simulada** | **Prazo** | **Parcela simulada** | **Desembolso efetivo com a equipe** |
|----------------------------------------|----------|----------------------|-------------------------------------|
| **M1 — Frontend dos fluxos prioritários com serviços simulados**: após demonstração e aceite interno | Semana letiva 8: GPTI 05/10/2026; PSW 06/10/2026 | **R$ 4.500,00 (50%)** | **R$ 0,00 — não há pagamento aos alunos** |
| **M2 — Sistema integrado ao backend Express/MongoDB**: após demonstração final e aceite interno | Semana letiva 12: PSW 10/11/2026; aceite GPTI 30/11/2026 | **R$ 4.500,00 (50%)** | **R$ 0,00 — não há pagamento aos alunos** |
| **Total da estimativa preliminar** | Período total estimado | **R$ 9.000,00 (100%)** | **R$ 0,00 de pagamento à equipe** |

O rateio de 50% por marco é uma convenção de apresentação da estimativa preliminar; não representa a distribuição real do esforço entre as etapas nem substitui a linha de base detalhada do Plano do Projeto. A estimativa apresentada **não constitui pagamento real, contrato, bolsa ou remuneração**, sendo utilizada exclusivamente para fins de planejamento e análise acadêmica.

Não estão incluídos custos efetivos de infraestrutura, licenças, serviços em nuvem, transporte, operação ou contratação de terceiros. A estimativa cobre o desenvolvimento acadêmico previsto, não uma implantação ou operação em produção.

Caso o projeto evolua para um cenário real, os custos deverão ser **reavaliados, detalhados e aprovados formalmente** pelo patrocinador e pela instituição antes de qualquer execução financeira.

## 11. Autoridade e aprovação

A aprovação deste termo autoriza o início do planejamento e do desenvolvimento acadêmico do AdotaPet dentro do escopo, das premissas e da duração aqui registrados. Ela estabelece a visão do produto e os marcos acadêmicos, sem significar que a implementação já esteja concluída ou que regras de adoção tenham sido validadas por organizações. Mudanças relevantes de escopo, prazo ou arquitetura deverão ser analisadas pela equipe de gestão e submetidas ao patrocinador segundo procedimento a definir. Uso de dados reais, integração com terceiros ou operação em produção requer definição e autorização próprias; essas condições não são concedidas automaticamente por este termo.

| Aprovação                       | Nome                      | Assinatura          | Data       |
| ------------------------------- | ------------------------- | ------------------- | ---------- |
| Patrocinador                    | Prof. Diogo Mendonça      | Aprovado e assinado | 05/10/2026 |
| Representante da equipe de GPTI | Pedro Pimentel Nunes      | Aprovado e assinado | 05/10/2026 |
| Representante da equipe de PSW  | Marcos Vinícius Silvestre | Aprovado e assinado | 05/10/2026 |
