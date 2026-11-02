# Status Report 2 — AdotaPet

## 1. Dados de controle

| Campo                       | Informação                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Projeto                     | AdotaPet                                                                                         |
| Data de status e corte      | 01/11/2026                                                                                       |
| Período coberto             | 03/08/2026 a 01/11/2026                                                                          |
| Medição direta disponível   | 07/10/2026 a 01/11/2026                                                                          |
| Linha de base utilizada     | Plano, EAP, Dicionário da EAP, cronograma e orçamento v1.0, aprovados/documentados em 05/10/2026 |
| Marco PSW                   | Entrega planejada para 10/11/2026                                                                |
| Marco GPTI                  | Aceite planejado para 30/11/2026                                                                 |
| BAC de atividades           | 216 h = 144 h PSW + 72 h GPTI                                                                    |
| Contingência                | 56 h = 32 h técnicas + 24 h de gestão                                                            |
| BAC com contingência        | 272 h = R$ 6.800,00                                                                              |
| Reserva gerencial           | 7%; R$ 476,00; fora da linha de base                                                             |
| Base de conversão econômica | R$ 25/h; valor de planejamento, não remuneração ou desembolso real                               |

> As 193 h registradas cobrem somente o período 07/10/2026–01/11/2026. Elas não representam esforço acumulado desde o início do projeto. As horas anteriores não foram recuperadas; por isso, nenhum custo real acumulado anterior é inventado neste relatório.

O corte permitido pelo enunciado é 02/11/2026. Os dados deste relatório são fixados em **01/11/2026**.

## 2. Respostas às perguntas do patrocinador

| Pergunta                                               | Resposta                                                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O caminho crítico entrega o Marco 2 na data planejada? | **Não demonstravelmente.** O cenário operacional prevê PSW em 16/11/2026, com atraso de seis dias, condicionado ao sequenciamento e à disponibilidade efetiva.                   |
| O VA mostra trabalho no ritmo e custo planejados?      | **Prazo desfavorável e custo acumulado indeterminado.** VA = 16 h e VP = 161–176 h; IDP/SPI = 0,091–0,099. VC/CV e IDC/CPI não podem ser calculados sem AC acumulado comparável. |
| As horas restantes cabem na capacidade?                | **PSW: não até 10/11.** Restam 23,5 h, mas há capacidade nominal de 15 h até 09/11. **GPTI: teoricamente cabe.** Restam 24 h e há capacidade nominal de até 40 h antes de 30/11. |

## 3. Situação geral

| Dimensão      | Situação     | Número e justificativa                                                                               |
| ------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| Escopo        | **Vermelho** | Nenhum dos pacotes 1.5.1–1.7.5 possui aceitação integral comprovada no corte.                        |
| Prazo         | **Vermelho** | Cenário indica 16/11 para PSW, seis dias após 10/11; faltam confirmação diária e capacidade efetiva. |
| Custo/esforço | **Amarelo**  | 193 h foram registradas apenas de 07/10 a 01/11; AC cumulativo não está disponível.                  |
| Recursos      | **Amarelo**  | 23,5 h PSW restantes e 24 h GPTI restantes; disponibilidade individual não confirmada.               |
| Mudanças      | **Vermelho** | CR-01 não possui registro formal de aprovação nem baseline revisada.                                 |

## 4. Escopo desde o Status Report 1

### 4.1 Pacotes verificados, pendentes e não demonstrados

| Pacote/EAP  | Situação no corte          | Evidência ou lacuna                                                                                                             |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1–1.1.2 | Parcial                    | Plano e monitoramento existem; decisão de CR-01, cronograma atualizado e apontamento histórico carecem de evidência formal.     |
| 1.1.3–1.1.4 | Pendente                   | Aceites de marcos e lições aprendidas não foram localizados integralmente.                                                      |
| 1.2.1–1.2.6 | Parcial                    | Requisitos documentados; REQ-13–REQ-15 requerem rastreabilidade confirmada.                                                     |
| 1.3.1       | Verificado no SR1          | Frontend React/TypeScript demonstrado e aceito internamente naquele corte.                                                      |
| 1.3.2–1.3.4 | Não demonstrado            | API Express própria, MongoDB e respostas conforme contratos não foram encontrados neste checkout.                               |
| 1.3.5–1.3.6 | Parcial                    | Mock e identidade fictícia existem; autorização de API e delimitação dos endpoints remanescentes não estão comprovados para M2. |
| 1.4.1–1.4.5 | Verificados no SR1         | Critérios de M1 foram verificados no snapshot do SR1.                                                                           |
| 1.4.6       | Pendente                   | Demonstração e aceite do M1, com ciência do patrocinador, não foram localizados.                                                |
| 1.5.1–1.5.8 | Não demonstrado            | Não há evidência verificável de CRUD/API/autorização/persistência MongoDB conforme o dicionário.                                |
| 1.6.1–1.6.5 | Não demonstrado ou parcial | Frontend integrado aos mocks não prova integrações persistentes ao M2.                                                          |
| 1.7.1–1.7.3 | Não demonstrado ou parcial | Faltam resultados de API, contrato, autorização, ponta a ponta e documentação técnica atualizada.                               |
| 1.7.4–1.7.5 | Pendente                   | Demonstração/aceite M2 e lições aprendidas são entregas futuras.                                                                |

A expressão **não demonstrado neste corte** significa que a evidência não foi encontrada nos documentos ou no checkout analisado; não constitui prova de que o trabalho não foi realizado em outro ambiente.

### 4.2 Verificação de conclusão

Uma atividade da baseline só é tratada como concluída quando todos os critérios observáveis correspondentes no Dicionário da EAP forem verificados. Execução informada, código existente ou merge Git não são aceite.

### 4.3 CR-01 — buscas salvas

| Evidência                 | Situação                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Implementação             | O merge/PR #90 e o histórico Git mostram buscas salvas persistidas localmente.           |
| Escopo aprovado           | Não foi localizado formulário, ata, e-mail ou decisão formal do patrocinador.            |
| Esforço reportado         | 3,75 h, incluídas uma vez nas 193 h.                                                     |
| Pessoa/atividade/semana   | Não identificadas nos apontamentos disponíveis.                                          |
| Controle de baseline      | Enquanto aguarda decisão formal, vale o plano original, conforme instrução do enunciado. |
| Trabalho fora da baseline | Registrado em CR-01; não recebe VA sem nova baseline aprovada.                           |

## 5. Cronograma

### 5.1 Calendário de referência

| Semana   | PSW                    | GPTI                     |
| -------- | ---------------------- | ------------------------ |
| S8 — M1  | 06/10/2026             | 05/10/2026               |
| S9       | 13/10/2026             | 26/10/2026               |
| S10      | 27/10–02/11/2026       | 09/11–15/11/2026         |
| S11      | 03/11–09/11/2026       | 16/11–22/11/2026         |
| S12 — M2 | 10/11/2026 (marco PSW) | 30/11/2026 (aceite GPTI) |

As datas reais informadas pela equipe não possuem atualização cronogramada datada anexada. Portanto, as “datas reais” abaixo representam informação consolidada pelo grupo, não evidência autônoma.

### 5.2 Atividades de controle

| ID  | Atividade                               | Responsável nominal na baseline | Início planejado | Fim planejado | Início real informado | Fim real/presunção | Início previsto restante | Término previsto restante |     Restante | Duração restante  | Situação no corte                                                        |
| --- | --------------------------------------- | ------------------------------- | ---------------- | ------------- | --------------------- | ------------------ | ------------------------ | ------------------------- | -----------: | ----------------- | ------------------------------------------------------------------------ |
| D01 | Regras e contrato da API                | PSW                             | 04/08 S1         | 31/08 S3      | 04/08                 | 25/08              | —                        | —                         |          0 h | 0 dias            | Execução informada concluída; aceite M2 não confunde conclusão técnica.  |
| D02 | Frontend prioritário para M1            | PSW                             | 04/08 S1         | 28/09 S7      | 04/08                 | 06/10              | —                        | —                         |          0 h | 0 dias            | Verificado no SR1; VA reconhecido.                                       |
| D03 | Express/MongoDB/erros                   | PSW                             | 25/08 S3         | 14/09 S5      | 25/08                 | 08/09              | —                        | —                         | não estimado | a estimar         | Execução informada concluída; validação técnica M2 pendente.             |
| D04 | CRUD de usuários                        | PSW                             | 01/09 S4         | 28/09 S7      | 01/09                 | 22/09              | —                        | —                         | não estimado | a estimar         | Execução informada concluída; aceite/correções pendentes.                |
| D05 | CRUD de pets                            | PSW                             | 01/09 S4         | 12/10 S8      | 01/09                 | 06/10              | —                        | —                         | não estimado | a estimar         | Execução informada concluída; persistência e aceite pendentes.           |
| D06 | Catálogo, pesquisa, filtros e paginação | PSW                             | 08/09 S5         | 12/10 S8      | 08/09                 | 06/10              | —                        | —                         |          0 h | 0 dias            | M1 frontend verificado; busca salva CR-01 pendente de formalização.      |
| D07 | Perfil, compatibilidade e favoritos     | PSW                             | 08/09 S5         | 12/10 S8      | 08/09                 | 06/10              | —                        | —                         | não estimado | a estimar         | Execução frontend informada concluída; persistência M2 pendente.         |
| D08 | Questionário e solicitações             | PSW                             | 15/09 S6         | 19/10 S9      | 15/09                 | 13/10              | —                        | —                         | não estimado | a estimar         | Execução mockada informada concluída; integração/API pendente.           |
| D09 | Aprovação, recusa e cancelamento        | PSW                             | 22/09 S7         | 02/11 S10     | 22/09                 | Prev. 09/11        | 03/11/2026               | 09/11/2026                |          3 h | até 3 dias úteis  | Em andamento; depende da estabilização de D08.                           |
| D10 | Conclusão de adoção e disponibilidade   | PSW                             | 13/10 S9         | 02/11 S10     | 13/10                 | 27/10              | —                        | —                         | não estimado | a estimar         | Execução informada concluída; verificação/aceite pendentes.              |
| D11 | Área do responsável                     | PSW                             | 22/09 S7         | 02/11 S10     | 22/09                 | Prev. 09/11        | 03/11/2026               | 09/11/2026                |        2,5 h | até 3 dias úteis  | Em andamento e integração pendente.                                      |
| D12 | Seed e mocks delimitados                | PSW                             | 25/08 S3         | 21/09 S6      | 25/08                 | 15/09              | —                        | —                         | não estimado | a estimar         | Execução informada concluída; delimitação M2 pendente.                   |
| D13 | Testes técnicos e correções             | PSW                             | 08/09 S5         | 09/11 S11     | 08/09                 | Prev. 16/11        | 03/11/2026               | 16/11/2026                |         12 h | até 10 dias úteis | Em andamento; 9,5 h em S11 e 2,5 h em S12 na alocação proposta.          |
| D14 | Integração final e demonstração M2      | PSW                             | 27/10 S10        | 10/11 S12     | Não iniciada          | Prev. 16/11        | 10/11/2026               | 16/11/2026                |          6 h | até 5 dias úteis  | Inicia sobreposto às frentes SS; conclusões FS são condicionantes.       |
| G01 | Business Case, TA e Plano               | GPTI                            | 24/08 S4         | 06/09 S5      | 24/08                 | 31/08              | —                        | —                         |          0 h | 0 dias            | Entregas documentais verificadas; VA reconhecido.                        |
| G02 | Escopo, EAP e requisitos                | GPTI                            | 24/08 S4         | 20/09 S6      | 24/08                 | 14/09              | —                        | —                         |          0 h | 0 dias            | Entregas documentais existentes; rastreabilidade pendente.               |
| G03 | Cronograma, recursos e orçamento        | GPTI                            | 31/08 S5         | 27/09 S7      | 31/08                 | 21/09              | —                        | —                         |          0 h | 0 dias            | Entregas documentais existentes; inconsistências abertas.                |
| G04 | Riscos, qualidade e comunicação         | GPTI                            | 31/08 S5         | 11/10 S8      | 31/08                 | 05/10              | —                        | —                         |          0 h | 0 dias            | Entregas documentais existentes; reavaliação pendente.                   |
| G05 | Revisão M1 e pendências                 | GPTI                            | 21/09 S7         | 11/10 S8      | 21/09                 | 05/10              | —                        | —                         |          0 h | 0 dias            | Ciência formal do M1 não localizada.                                     |
| G06 | Monitoramento e controle                | GPTI                            | 24/08 S4         | 30/11 S12     | 24/08                 | Prev. 22/11        | 09/11/2026               | 22/11/2026                |          8 h | até 10 dias úteis | Em andamento contínuo.                                                   |
| G07 | Relatórios, encerramento e lições       | GPTI                            | 05/10 S8         | 30/11 S12     | Não iniciada          | Prev. 22/11        | 09/11/2026               | 22/11/2026                |         16 h | até 10 dias úteis | Parte do trabalho está na semana do aceite; disponibilidade a confirmar. |

> **Convenção:** "não estimado" indica trabalho provável de validação, correção ou aceite sem estimativa confiável. Diferencia-se de 0 h, que indica execução informada concluída sem saldo remanescente estimado.

As datas previstas têm caráter gerencial: não substituem calendário diário aprovado nem disponibilidade efetivamente confirmada. D09, D10 e D12 precedem D14 por FS; D11 e D13 o precedem por SS, permitindo sobreposição parcial.

## 6. Valor agregado por atividade

### 6.1 AC por atividade — reconciliação parcial

As 193 h registradas são um total consolidado do período; o detalhamento por atividade foi informado, mas não existe apontamento auditável que separe as 3,75 h da CR-01. Portanto, os ACs por atividade abaixo são **provisórios e parcialmente conciliados**. Nenhuma parcela da CR-01 foi atribuída artificialmente a uma atividade da baseline.

| ID                | BAC (h) | AC provisório informado no corte (h) |    Saldo (h) | Situação da reconciliação                                               |
| ----------------- | ------: | -----------------------------------: | -----------: | ----------------------------------------------------------------------- |
| D01               |      10 |                                10,50 |            0 | Pode conter trabalho não discriminado; não fechar como definitivo.      |
| D02               |       8 |                                10,50 |            0 | Parcialmente reconciliado; D02 possui VA, não exclusão da CR-01.        |
| D03               |      12 |                                10,25 | não estimado | Parcialmente reconciliado.                                              |
| D04               |      12 |                                10,75 | não estimado | Parcialmente reconciliado.                                              |
| D05               |      12 |                                11,00 | não estimado | Parcialmente reconciliado.                                              |
| D06               |      10 |                                11,00 |            0 | Parcialmente reconciliado; pode conter atividade relacionada à mudança. |
| D07               |      10 |                                 7,00 | não estimado | Parcialmente reconciliado.                                              |
| D08               |      12 |                                 7,00 | não estimado | Parcialmente reconciliado.                                              |
| D09               |      14 |                                10,75 |            3 | Parcialmente reconciliado.                                              |
| D10               |       8 |                                 7,00 | não estimado | Parcialmente reconciliado.                                              |
| D11               |      10 |                                 7,00 |          2,5 | Parcialmente reconciliado.                                              |
| D12               |       6 |                                 6,50 | não estimado | Parcialmente reconciliado.                                              |
| D13               |      14 |                                 3,50 |           12 | Parcialmente reconciliado.                                              |
| D14               |       6 |                                    0 |            6 | Não iniciado.                                                           |
| G01               |       8 |                                13,75 |            0 | Parcialmente reconciliado.                                              |
| G02               |      10 |                                14,00 |            0 | Parcialmente reconciliado.                                              |
| G03               |      10 |                                13,75 |            0 | Parcialmente reconciliado.                                              |
| G04               |       8 |                                14,50 |            0 | Parcialmente reconciliado.                                              |
| G05               |       4 |                                10,50 |            0 | Parcialmente reconciliado.                                              |
| G06               |      16 |                                13,75 |            8 | Parcialmente reconciliado.                                              |
| G07               |      16 |                                    0 |           16 | Parcialmente reconciliado.                                              |
| CR-01 não alocada |       — |                                 3,75 |            — | Não atribuída a nenhuma atividade; aguarda apontamento.                 |

**Reconciliação aritmética do total:** os valores individuais provisórios somam 193 h conforme informados pelo grupo, mas pode ser que já contenham parte ou a totalidade das 3,75 h da CR-01. Por isso, a linha CR-01 não é adicionada ao subtotal da baseline. O total consolidado do período é 193 h; origem e pessoa dessas 3,75 h permanecem pendentes de apontamento.

### 6.2 Crédito de valor agregado

Regra adotada: **0/100**. Uma atividade recebe o esforço planejado integral somente após verificação integral dos critérios do Dicionário da EAP. Em andamento, VA = 0.

| ID        | Esforço | Evidência                                              |       VA |
| --------- | ------: | ------------------------------------------------------ | -------: |
| D02       |     8 h | Critérios 1.4.1–1.4.5 verificados no SR1.              |      8 h |
| G01       |     8 h | Business Case, Termo de Abertura e Plano documentados. |      8 h |
| **Total** |       — | —                                                      | **16 h** |

## 7. Totais, variações, índices e previsão

### 7.1 Totais e origem

| Medida                       |            Horas | Origem/cálculo                                                      |
| ---------------------------- | ---------------: | ------------------------------------------------------------------- |
| VP/PV acumulado até 01/11    |        161–176 h | 161 h até S9 + até 15 h PSW de S10; depende do time-phasing diário. |
| VA/EV acumulado              |             16 h | D02 8 h + G01 8 h.                                                  |
| CR/AC medido                 |            193 h | 112,75 h PSW + 80,25 h GPTI, 07/10–01/11.                           |
| AC acumulado                 | Não determinável | Apontamentos anteriores não recuperados.                            |
| BAC de atividades            |            216 h | Plano v1.0.                                                         |
| Contingência                 |             56 h | Plano v1.0.                                                         |
| BAC com contingência         |            272 h | 216 + 56.                                                           |
| Esforço restante operacional |           47,5 h | 23,5 h PSW + 24 h GPTI.                                             |

### 7.2 Variações e índices

| Indicador | Fórmula | Resultado no corte | Observação                                   |
| --------- | ------- | -----------------: | -------------------------------------------- |
| VPr/SV    | VA − VP |      −145 a −160 h | Intervalo por VP 161–176 h.                  |
| IDP/SPI   | VA ÷ VP |        0,091–0,099 | Intervalo por VP.                            |
| VC/CV     | VA − AC |   Não determinável | AC acumulado não disponível.                 |
| IDC/CPI   | VA ÷ AC |   Não determinável | 193 h são período parcial, não AC acumulado. |

### 7.3 EAC/ETC

Fórmulas:

- **EPT/ETC = esforço restante estimado até conclusão.** Neste corte, EPT = 47,5 h, sujeito a reconciliação de 55 h planejadas após S9.
- **ENT/EAC = AC acumulado + ETC.** Não é determinável porque o AC acumulado não foi recuperado.
- Pelo método baseado em desempenho: ENT = BAC ÷ IDC. Não aplicável neste corte, pois IDC não é válido sem AC acumulado.

A premissa de 47,5 h representa somente o esforço de execução operacional informado pela equipe. Os trabalhos de validação, correção ou aceite marcados como "não estimado" não estão incluídos nesse subtotal até que sejam estimados e aprovados. Assim, o EPT real pode ser maior que 47,5 h e não será elevado por suposição.

## 8. Recursos

### 8.1 Horas planejadas e apontadas por pessoa

| Pessoa                             | Equipe | Planejado total | Apontado 07/10–01/11 |             Restante informado | Capacidade nominal futura |
| ---------------------------------- | ------ | --------------: | -------------------: | -----------------------------: | ------------------------: |
| Igor Pereira                       | PSW    |            48 h |              34,75 h | não reconciliado por indivíduo |            até 5 h/semana |
| Marcos Vinícius Silvestre          | PSW    |            48 h |              43,00 h | não reconciliado por indivíduo |            até 5 h/semana |
| Lucas Ferreira de Paula            | PSW    |            48 h |              35,00 h | não reconciliado por indivíduo |            até 5 h/semana |
| Pedro Pimentel Nunes               | GPTI   |            18 h |              17,50 h | não reconciliado por indivíduo |            até 5 h/semana |
| Ana Isabel Matias da Silva Basilio | GPTI   |            18 h |              20,50 h | não reconciliado por indivíduo |            até 5 h/semana |
| Beatriz Cardoso Abdias             | GPTI   |            18 h |              21,25 h | não reconciliado por indivíduo |            até 5 h/semana |
| Tamires Barbosa dos Santos         | GPTI   |            18 h |              21,00 h | não reconciliado por indivíduo |            até 5 h/semana |
| **PSW**                            |        |       **144 h** |         **112,75 h** |                     **23,5 h** |               15 h em S11 |
| **GPTI**                           |        |        **72 h** |          **80,25 h** |                       **24 h** |   40 h teóricas até 22/11 |
| **Total**                          |        |       **216 h** |            **193 h** |                     **47,5 h** |                           |

As linhas individuais de restante não devem ser fechadas por diferença aritmética; falta conciliação em apontamentos por pessoa, atividade e semana.

### 8.2 Cenário de alocação PSW

| Semana       | Pessoa | Atividades            | Total |
| ------------ | ------ | --------------------- | ----: |
| S11 03–09/11 | Igor   | D09 2 h + D13 3 h     |   5 h |
| S11 03–09/11 | Marcos | D11 2,5 h + D13 2,5 h |   5 h |
| S11 03–09/11 | Lucas  | D09 1 h + D13 4 h     |   5 h |
| S12 10–16/11 | Igor   | D14 3 h               |   3 h |
| S12 10–16/11 | Marcos | D13 2,5 h             | 2,5 h |
| S12 10–16/11 | Lucas  | D14 3 h               |   3 h |

**Total PSW: 23,5 h.** Até 09/11 são utilizadas 15 h; 8,5 h ficam fora ou iniciam na semana do marco.

### 8.3 Cenário de alocação GPTI

Em S10 e S11, cada integrante aloca 3 h/semana em G06/G07 (1 h G06 + 2 h G07), perfazendo 6 h por pessoa, 24 h totais, com folga teórica de 16 h.

### 8.4 Registro temporal consolidado

| Período     |      PSW |    GPTI |    Total |
| ----------- | -------: | ------: | -------: |
| 07–11/10    |  20,50 h | 11,75 h |  32,25 h |
| 12–18/10    |  29,00 h | 19,50 h |  48,50 h |
| 19–25/10    |  32,25 h | 23,00 h |  55,25 h |
| 26/10–01/11 |  31,00 h | 26,00 h |  57,00 h |
| Total       | 112,75 h | 80,25 h | 193,00 h |

Esses registros são consolidados pela equipe. Não substituem apontamentos semanais auditáveis por atividade.

## 9. Questões, mudanças e riscos

### 9.1 Questões

| ID   | Questão                                                                   | Dono          | Prazo           | Impacto escopo                 | Impacto prazo               | Impacto custo/esforço                       | Situação                       |
| ---- | ------------------------------------------------------------------------- | ------------- | --------------- | ------------------------------ | --------------------------- | ------------------------------------------- | ------------------------------ |
| Q-01 | Falha `spawn EINVAL` em `npm run dev:mock`                                | Marcos/Igor   | Proposta: 04/11 | Nenhum se operacional          | Possível atraso do ambiente | 1 h estimada                                | Não encerrada documentalmente. |
| Q-02 | Cenário de perfil incompleto                                              | Marcos/Igor   | Proposta: 04/11 | Pode exigir correção funcional | Até teste da correção       | 1 h estimada                                | Não encerrada.                 |
| Q-03 | Demonstrar e registrar aceite M1                                          | Pedro         | Proposta: 04/11 | Mantém 1.4.6 pendente          | Afeta aceite e VA           | 2 h estimadas                               | Sem ata/evidência localizada.  |
| Q-04 | Rastreabilidade REQ-13–REQ-15                                             | Ana/Pedro     | Proposta: 04/11 | Pode exigir mudança formal     | Nenhum sem alteração        | 1 h estimada                                | Rastreabilidade pendente.      |
| Q-06 | Apontamentos anteriores a 07/10                                           | Pedro         | 04/11           | Nenhum                         | Replanejamento posterior    | Impede AC acumulado                         | Aberta.                        |
| Q-07 | Saldo PSW não cabe até 10/11                                              | Pedro         | 04/11           | Nenhum no plano atual          | +6 dias                     | 8,5 h após 09/11                            | Aberta para decisão.           |
| Q-08 | Divergência de D13 entre Plano e Gantt                                    | Pedro/Marcos  | 04/11           | Nenhum por si só               | Afeta VP/time-phasing       | 14 h da atividade                           | Aberta.                        |
| Q-09 | D14 alocado parcialmente em 10/11                                         | Igor/Pedro    | 04/11           | Nenhum                         | Pode comprometer o marco    | 6 h                                         | Aberta.                        |
| Q-10 | 8 h de G07 na semana do aceite GPTI                                       | Pedro/GPTI    | 04/11           | Nenhum                         | Pode comprometer aceite     | 8 h                                         | Aberta.                        |
| Q-13 | Obter AC acumulado comparável                                             | Pedro/GPTI    | 04/11           | Nenhum                         | Pode mudar cronograma       | Esforço a estimar                           | Aberta.                        |
| Q-14 | Explicar diferença de 7,5 h entre 55 h planejadas após S9 e EPT de 47,5 h | Pedro/Beatriz | 04/11           | Nenhum até evidência           | Pode alterar ETC/EAC        | 7,5 h não devem ser somadas sem comprovação | Aberta.                        |

### 9.2 Mudança

| ID    | Tipo    | Descrição                            | Dono        | Prazo | Escopo                                   | Prazo                                    | Custo/esforço     | Situação               |
| ----- | ------- | ------------------------------------ | ----------- | ----- | ---------------------------------------- | ---------------------------------------- | ----------------- | ---------------------- |
| CR-01 | Mudança | Buscas salvas com persistência local | Lucas/Pedro | 04/11 | Funcionalidade fora da baseline original | Sem impacto aprovado; depende de decisão | 3,75 h reportadas | Pendente de aprovação. |

### 9.3 Riscos ativos relevantes

| ID   | Risco                                | Dono  | Evidência                           | Resposta                                    |
| ---- | ------------------------------------ | ----- | ----------------------------------- | ------------------------------------------- |
| RT01 | Curva de aprendizado Express/MongoDB | PSW   | API/banco não demonstrados          | Pareamento técnico, integração incremental. |
| RT03 | Divergência frontend/API             | PSW   | Contratos e backend não comprovados | Testes de contrato e regressão.             |
| RG02 | Falta de capacidade para M2          | Pedro | Déficit PSW de 8,5 h                | Replanejar marco ou escopo formalmente.     |

## 10. Decisões solicitadas ao patrocinador

| Opção                               | Escopo                                                     | Prazo                                         | Horas/custo                                                            | Recomendação                                            |
| ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| A — aprovar CR-01 e reprogramar PSW | Incorpora buscas salvas à nova baseline                    | Marco PSW em 16/11 (+6 dias)                  | Acrescentar formalmente 3,75 h; BAC futuro depende da decisão aprovada | Preferível, com escopo completo reconhecido.            |
| B — manter 10/11 com desescopo      | Transferir D11 parcial, parte de D13 ou pacotes integrados | Tenta entregar 10/11                          | Exige que pelo menos 8,5 h saiam do compromisso de M2                  | Maior risco técnico; impacta aceite M2.                 |
| C — rejeitar CR-01                  | Remover buscas salvas de entregas e código                 | Não altera o caminho crítico PSW isoladamente | Exige estimar retrabalho/expurgo de 3,75 h já gastas                   | Adequado somente com decisão formal; não garante 10/11. |

A recomendação gerencial é **Opção A**, desde que a decisão formal registre escopo, prazo, custo, responsável, data e versão da nova baseline.

## 11. Próximas ações

| Ação                                                                                                                                                                                           | Responsável       | Prazo      | Evidência esperada                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------- | --------------------------------------------------- |
| Recuperar apontamentos anteriores a 07/10                                                                                                                                                      | Pedro Nunes       | 04/11/2026 | Planilha por pessoa, atividade, semana e evidência  |
| Formalizar CR-01 e separar suas 3,75 h                                                                                                                                                         | Lucas/Pedro       | 04/11/2026 | Ata/e-mail, registro de mudança e baseline proposta |
| Conciliar D13, D14 e G07 em calendário diário                                                                                                                                                  | Pedro/Marcos/Igor | 04/11/2026 | Cronograma atualizado e dependências                |
| Confirmar disponibilidade individual                                                                                                                                                           | Sete integrantes  | 04/11/2026 | Alocação semanal assinada                           |
| Executar testes de API, contrato e integração                                                                                                                                                  | PSW/GPTI          | 12/11/2026 | Relatório e evidências de execução                  |
| Atualizar EVM após recuperar AC                                                                                                                                                                | Pedro/Beatriz     | 16/11/2026 | Memória de cálculo reproduzível                     |
| Estimar, por D03, D04, D05, D07, D08, D10 e D12, o esforço necessário para validação técnica, correção e aceite; registrar responsáveis, prazo e critérios de saída antes de consolidar o EPT. | PSW/GPTI          | 12/11/2026 | Relatório e evidências de execução                  |

## 12. Conclusão

1. **Prazo:** o caminho crítico operacional não demonstra entrega PSW em 10/11; o cenário atualizado prevê 16/11. GPTI possui folga teórica até 30/11.
2. **Valor agregado:** VA = 16 h, com baixa homologação documental. VP = 161–176 h, resultando em IDP/SPI desfavorável. Custo acumulado não está disponível para avaliar IDC/CPI, VC/CV, EAC/ETC.
3. **Capacidade:** PSW excede 15 h disponíveis até 09/11 em 8,5 h. GPTI tem folga teórica de 16 h, mas depende da confirmação individual.

Este relatório não aprova nova baseline nem reprogramação. Use o plano vigente até existir decisão formal do patrocinador, conforme a regra de controle de mudanças.
