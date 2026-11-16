# Ata — AdotaPet
**Projeto:** AdotaPet

**Período:** 02/11/2026 a 16/11/2026

**Canal de comunicação :** grupo de WhatsApp da equipe
**Natureza:** acompanhamento semanal.

## Participantes do projeto

Todos os integrantes abaixo participam, conforme a composição da equipe no plano do projeto:

### GPTI — Gerência de Projetos de TI

- Ana Isabel Matias da Silva Basilio
- Beatriz Cardoso Abdias
- Pedro Pimentel Nunes — gerente do projeto
- Tamires Barbosa dos Santos

### PSW — Programação Web

- Igor Pereira
- Marcos Vinícius Silvestre
- Lucas Ferreira


## Registro 1 — Semana de 02/11 a 08/11/2026

**Data:** 04/11/2026

**Participantes:** os sete integrantes listados acima.

**Horário/duração:** não se aplica; conversa assíncrona.
### Pauta

1. Revisar as pendências e a previsão do Status Report 2.
2. Confirmar que a data-base PSW de 10/11 não foi alterada formalmente, embora ooperacional apontasse 16/11.
3. Tratar a CR-01 (buscas salvas) como pendente até decisão formal do patrocinador.
4. Conferir horas, disponibilidade, riscos técnicos e preparação do M2.

### Registro 

- GPTI apresenta as pendências do Status Report 2: reconciliação de horas, confirmação de capacidade, divergências de cronograma e falta de decisão formal para a CR-01.
- PSW informa que atividade de desenvolvimento não equivale a teste aprovado nem a aceite de pacote.
- A equipe observa que as estimativas informais de horas não substituem apontamento por pessoa, atividade e semana.
- O grupo decide encaminhar ao patrocinador um pedido de decisão sobre a CR-01 e solicitar confirmação do estado do marco PSW. 

### Decisões e ações 

| Ação | Responsável | Prazo  | Evidência |
| --- | --- | --- | --- |
| Reconciliar atividades, horas realizadas e esforço restante | PSW + Pedro | 09/11 | Registro por integrante, atividade e semana |
| Atualizar riscos RT01, RT03 e RG02 com gatilho e resposta executável | GPTI + PSW | 09/11 | Registro de risco atualizado |
| Solicitar decisão formal da CR-01, sem alterar a baseline antes da resposta | Pedro | 09/11 | Mensagem enviada e decisão/recebimento registrados |

**Resultado :** nenhuma mudança de baseline ou aceite é declarado nesta semana.

## Registro 2 — Semana de 09/11 a 15/11/2026

**Data:** 12/11/2026

**Participantes:** os sete integrantes listados acima.

**Horário/duração:** não se aplica; conversa assíncrona.

### Pauta

1. Revisar o progresso técnico e as pendências para a previsão PSW de 16/11.
2. Conferir se há registro de decisão da CR-01.
3. Confirmar execução de testes, integração e disponibilidade da equipe.
4. Atualizar o risco de capacidade e o plano para o M2 de 30/11.

### Registro

- A equipe revisa os eventos verificáveis no Git: commit `c7947df` de 12/11 e a alteração `14ee527` de 14/11, posteriormente revertida por `4d1c6c8`.
- O grupo registra que esses commits demonstram atividade no repositório, mas não confirmam horas trabalhadas, aprovação de escopo, resultado de testes ou aceite.
- Não havendo decisão formal documentada da CR-01, a equipe mantém a mudança como pendente e não presume alteração da baseline.
- GPTI solicita à PSW evidências de testes e uma previsão atualizada de capacidade. A resposta e os resultados de teste não são inventados como concluídos nesta ata.

### Decisões e ações 

| Ação  | Responsável | Prazo | Evidência  |
| --- | --- | --- | --- |
| Confirmar entrega PSW, critérios demonstrados e pendências | PSW + GPTI | 16/11 | Checklist de aceite e evidências |
| Executar e registrar testes de contrato, integração e regressão | PSW | 18/11 | Relatório de execução, defeitos e retestes |
| Atualizar previsão de M2 com disponibilidade confirmada | Pedro + equipe | 18/11 | Cronograma e horas restantes |
| Reiterar pedido de decisão sobre CR-01 | Pedro | 16/11 | Envio e resposta do patrocinador registrados |


## Registro 3 — Semana iniciada em 16/11/2026 (parcial)

**Data:** 16/11/2026

**Participantes:** os sete integrantes listados acima.

**Horário/duração:** não se aplica; conversa assíncrona.

### Pauta

1. Revisar a integração `852e756` no repositório.
2. Confirmar entrega/aceite PSW e pendências.
3. Conferir os riscos de integração, capacidade e mudança.
4. Definir próximos passos para o M2 previsto em 30/11.

### Registro 
- A equipe observa que o merge `852e756` integrou alterações de aplicação, API simulada, documentação e testes.
- A suíte não é declarada aprovada: no checkout analisado não foi executada por ausência de `node_modules`.
- O README continua descrevendo frontend e API REST simulada, sem backend, banco de dados ou autenticação reais.
- O grupo mantém RT01, RT03 e RG02 em acompanhamento e registra que não há evidência suficiente para medir a eficácia das respostas.
- A CR-01 continua pendente até decisão formal. O merge não é tratado como aprovação.

### Decisões e ações 

| Ação  | Responsável | Prazo  | Evidência  |
| --- | --- | --- | --- |
| Registrar se o marco PSW foi entregue e quais critérios foram demonstrados | Pedro + PSW | 17/11 | Checklist, evidências e pendências |
| Atualizar cronograma, capacidade e previsão M2 | Pedro + equipe | 18/11 | Cronograma e apontamentos revisados |
| Executar testes em ambiente instalado e documentar o resultado | PSW + GPTI | 20/11 | Relatório de teste e retestes |
| Submeter CR-01 ao patrocinador com análise de impacto | Pedro + Lucas | 18/11 | Decisão formal e baseline revisada, se aprovada |



## Registro de comunicação

| Data | Responsável | Canal | Destinatário | Mensagem/assunto | Recebimento |
| --- | --- | --- | --- | --- | --- |
| 04/11 | Pedro / GPTI | WhatsApp do grupo | Equipe | Solicitar atualização de tarefas, horas e riscos | Respostas dos integrantes; horas continuam pendentes de reconciliação |
| 09/11 | Pedro / GPTI | WhatsApp | Patrocinador | Solicitar decisão sobre CR-01 e confirmação do marco | Envio; nenhuma resposta do patrocinador é inventada |
| 12/11 | GPTI | WhatsApp do grupo | Equipe | Solicitar evidência de testes e previsão de M2 | Ação registrada; efeito depende dos artefatos de teste e cronograma |
| 16/11 | Pedro / GPTI | WhatsApp | Patrocinador | Solicitar estado do marco PSW e previsão de M2 | Envio ; recebimento/decisão permanecem sem confirmação |

