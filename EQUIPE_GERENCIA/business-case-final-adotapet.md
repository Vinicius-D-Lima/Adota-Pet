# Business Case — AdotaPet

**Versão:** 1.0 — proposta acadêmica  
**Data:** 05/10/2026

## 1. Resumo executivo

Propõe-se desenvolver o AdotaPet, um protótipo acadêmico de plataforma web para organizar a divulgação de pets e o acompanhamento de solicitações de adoção. A iniciativa responde à dispersão de informações em redes sociais, grupos de mensagens e outros canais informais, que pode dificultar a busca por animais e a organização dos pedidos por adotantes e responsáveis.

## 2. Problema e oportunidade

A divulgação de pets disponíveis para adoção ocorre de forma informal e descentralizada. Publicações em diferentes canais podem dificultar a localização de animais adequados, a comparação de informações e a atualização de sua disponibilidade. Responsáveis também podem precisar organizar contatos e solicitações sem um fluxo único.

A oportunidade é demonstrar como um canal digital pode reunir informações dos pets, permitir buscas por características relevantes e estruturar as etapas de solicitação.

## 3. Objetivos

Os objetivos orientam um projeto de 12 semanas letivas efetivas, aproximadamente quatro meses de calendário. A validação será acadêmica e interna, nos marcos previstos para as semanas 8 e 12; não se presume impacto social ou operacional em organizações externas.

- Demonstrar a consulta e a busca de pets por características como espécie, porte, idade, sexo e localização.
- Validar o fluxo do adotante, desde a consulta aos detalhes do pet até o envio e o acompanhamento de uma solicitação.
- Evoluir o protótipo integrando frontend, API em Express e persistência em MongoDB.
- Representar os papéis de adotante e responsável com identidades fictícias, sem autenticação real.

## 4. Solução proposta

A solução planejada é uma plataforma web para consulta de pets e organização do ciclo de adoção. O adotante poderá pesquisar animais, consultar informações, preencher um questionário e acompanhar sua solicitação. O responsável deverá poder cadastrar pets e analisar solicitações, conforme as regras que forem definidas para o protótipo.

## 5. Escopo inicial

### Incluído

- Levantamento e validação das regras do fluxo de adoção.
- Evolução do frontend para consulta, busca e visualização de pets.
- Implementação dos fluxos previstos para solicitações, análise e conclusão da adoção.
- API própria em Node.js com Express e persistência em MongoDB, conforme planejamento do Termo de Abertura.
- Simulação de login e logout com identidades fictícias.
- Testes funcionais, documentação essencial e demonstração acadêmica.

### Fora do escopo inicial

- Autenticação real ou integração com provedores de identidade.
- Uso de credenciais ou dados pessoais reais.
- Integração com sistemas externos ou serviços de terceiros.
- Implantação, operação e manutenção em produção.
- Funcionalidades fora dos casos de uso definidos sem avaliação formal de mudança.

## 6. Benefícios esperados

- Centralizar informações de pets em uma plataforma, condicionada à atualização e consistência dos dados.
- Facilitar a busca por características relevantes, como espécie, porte, idade, sexo e localização.
- Organizar e tornar mais compreensível o acompanhamento das solicitações de adoção.
- Reduzir a dispersão de informações e o retrabalho associado a controles informais, caso a solução seja utilizada pelos públicos previstos.
- Oferecer uma experiência de consulta e solicitação mais estruturada.

Esses benefícios são expectativas do projeto. Não há pesquisa de campo, linha de base ou dados de uso que comprovem impacto ou permitam quantificá-los.

## 7. Alternativas consideradas

1. **Manter o modelo atual:** evita esforço imediato de desenvolvimento, mas mantém a divulgação distribuída em diferentes canais e não estrutura o acompanhamento das solicitações.
2. **Organizar canais existentes:** planilhas ou formulários padronizados poderiam melhorar parte do registro, mas manteriam limitações de centralização e rastreabilidade.
3. **Desenvolver o AdotaPet:** permite demonstrar, no escopo acadêmico, um fluxo digital integrado de consulta e solicitação. Não substitui uma decisão futura sobre validação, implantação e operação real.

Recomenda-se a terceira alternativa para fins de prototipação e aprendizagem, sem presumir adoção institucional ou benefícios comprovados.

## 8. Custos e recursos

Há uma estimativa econômica simulada de mão de obra na seção 12, relativa ao protótipo. Não é orçamento aprovado nem custo de uma solução pronta para operação. O Termo de Abertura prevê pagamento efetivo de R$ 0,00 à equipe. Uma futura implantação e operação deverá considerar, no mínimo:

- Levantamento e validação das regras e dos fluxos de adoção.
- Desenvolvimento do protótipo em React e TypeScript, com API em Node.js e Express e persistência em MongoDB, conforme o escopo acadêmico.
- Infraestrutura, segurança, testes e implantação, caso haja decisão futura de uso real.
- Treinamento, comunicação e suporte aos usuários, se a solução vier a ser implantada.
- Manutenção e evolução após a conclusão do projeto.

Os recursos desta etapa são sete alunos (três de PSW e quatro de GPTI), computadores pessoais e ferramentas gratuitas ou já disponíveis. A equipe de PSW desenvolve o produto; GPTI conduz a gestão e a validação interna. A capacidade efetiva considerada no calendário é de 360 horas; o esforço das atividades planejadas é de 216 horas, com 56 horas de contingência para riscos identificados.

Uma eventual operação após o projeto exigiria estimativa própria para infraestrutura, segurança, implantação, comunicação, suporte e manutenção; esses custos não integram a linha de base acadêmica.

## 9. Riscos e dependências

| Risco ou dependência                             | Impacto potencial                                   | Ação inicial                                                                             |
| ------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Regras de adoção incompletas                     | Retrabalho ou comportamento inconsistente           | Registrar e validar as regras antes de implementar cada fluxo                            |
| Integração entre frontend, API e banco           | Atrasos e falhas funcionais                         | Definir contratos e integrar os componentes gradualmente                                 |
| Estimativa de esforço inconsistente              | Planejamento e avaliação econômica pouco confiáveis | Reconciliar as 256 horas documentadas com a dedicação e o prazo previstos                |
| Dados demonstrativos confundidos com dados reais | Informação incorreta sobre pets ou disponibilidade  | Identificar os dados como fictícios e manter o uso restrito à demonstração               |
| Expectativa de uso em produção                   | Riscos de segurança, privacidade e continuidade     | Comunicar os limites do protótipo; exigir validação e autorização para qualquer uso real |

## 10. Indicadores de sucesso

Os indicadores de protótipo verificam entregas e fluxos em ambiente acadêmico. Métricas de adoção real dependem de implantação, linha de base e participação dos públicos envolvidos.

| Indicador                                            | Como avaliar                                             | Aplicação                               |
| ---------------------------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| Fluxo do adotante                                    | Teste de ponta a ponta, da busca ao envio da solicitação | Protótipo                               |
| Funcionalidade dos módulos priorizados               | Casos de teste definidos para cada entrega               | Protótipo                               |
| Integração entre frontend, API e banco de dados      | Testes de integração após a implementação                | Protótipo, conforme o escopo técnico    |
| Clareza do fluxo                                     | Avaliação acadêmica pela equipe e pelo patrocinador      | Protótipo                               |
| Satisfação, tempo de atendimento e taxa de conclusão | Medição com usuários e operação real                     | Etapa futura; metas ainda não definidas |

## 11. Recomendação e próximos passos

Recomenda-se desenvolver o AdotaPet como protótipo acadêmico, dentro do escopo, prazo e premissas do Termo de Abertura. A aprovação não representa autorização para uso de dados reais, integração externa ou operação em produção.

1. Reconciliar a estimativa de esforço e custo com a dedicação e o prazo documentados.
2. Confirmar requisitos prioritários, perfis e regras do fluxo de adoção.
3. Definir critérios de aceite para os marcos das semanas 8 e 12.
4. Integrar frontend, API e banco de dados de forma incremental e testar os fluxos principais com dados fictícios.
5. Registrar riscos, limitações e pendências na demonstração final.
6. Tratar eventual continuidade, implantação e operação real como decisão e análise separadas.

## 12. Análise de viabilidade e continuidade

### 12.1 Viabilidade do protótipo acadêmico

O projeto tem 12 semanas letivas efetivas, entre 03/08 e 30/11/2026, com sete alunos: três de PSW e quatro de GPTI. O calendário considera 12 semanas de participação de PSW e nove semanas de trabalho de GPTI, totalizando 360 horas de capacidade efetiva. M1 demonstra os fluxos prioritários do frontend na semana 8; M2 demonstra o sistema integrado na semana 12. A viabilidade avaliada é a conclusão dessas entregas acadêmicas, não a operação em produção.

### 12.2 Esforço e recursos estimados

O Termo de Abertura registra uma estimativa preliminar de iniciação de R$ 9.000,00, baseada na capacidade efetiva de 360 horas e com faixa de −25% a +75% (R$ 6.750,00 a R$ 15.750,00). Essa estimativa de ordem de grandeza não pressupõe uso de toda a capacidade.

O Plano do Projeto detalha uma linha de base diferente, derivada do trabalho planejado:

| Componente                                    |             Esforço | Valor econômico simulado |
| --------------------------------------------- | ------------------: | -----------------------: |
| Atividades planejadas (144 h PSW + 72 h GPTI) |               216 h |              R$ 5.400,00 |
| Contingência para riscos identificados        |                56 h |              R$ 1.400,00 |
| **Linha de base de custos**                   |           **272 h** |          **R$ 6.800,00** |
| Reserva gerencial (7%)                        |                   — |                R$ 476,00 |
| **Orçamento total simulado**                  | **272 h + reserva** |          **R$ 7.276,00** |

A diferença é intencional: R$ 9.000,00 é a estimativa preliminar da capacidade disponível; R$ 7.276,00 é a linha de base detalhada de atividades e reservas. A contingência só é usada para riscos identificados. Nenhum valor representa pagamento aos alunos; o desembolso real previsto é R$ 0,00. Ferramentas e infraestrutura são gratuitas ou já disponíveis; operação e produção não estão orçadas.

### 12.3 Valor esperado e limites da análise

O valor esperado nesta etapa é principalmente acadêmico e de validação do produto: desenvolver e testar os fluxos previstos, integrar frontend, API e persistência e identificar pendências antes de qualquer continuidade. Para os públicos previstos, a solução pode facilitar a busca por pets e organizar solicitações, mas esses benefícios ainda não foram validados em campo.

Não há dados sobre volume de adoções, duração do processo atual, custos de responsáveis ou organizações, ou economias que poderiam ser realizadas. Assim, não há base para projetar retorno financeiro ou impactos sociais quantitativos. Indicadores como conclusão dos fluxos do protótipo, consistência dos dados e avaliação acadêmica podem ser usados nesta etapa; tempo de atendimento, satisfação de usuários e resultados de adoção exigem participação de usuários e operação real.

### 12.4 Condições para uma etapa futura

Uma decisão de continuidade ou implantação deve ser precedida por:

- validação do problema, dos perfis e das regras com adotantes e responsáveis por pets;
- confirmação da estimativa de esforço e elaboração de orçamento compatível com o escopo futuro;
- estimativa de hospedagem, segurança, privacidade, suporte, manutenção e responsabilidades operacionais;
- definição de um piloto autorizado e de indicadores com linha de base, como tempo de atendimento, solicitações concluídas e satisfação dos usuários.

Com as informações atuais, o AdotaPet pode ser avaliado como protótipo acadêmico dentro do escopo e do orçamento simulado do Plano do Projeto. A viabilidade financeira e operacional de uma solução em produção permanece indeterminada e deve ser analisada separadamente, com dados, custos e autorização próprios.
