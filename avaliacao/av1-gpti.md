# Correção da AV1 — GPTI — AdotaPet

Repositório: https://github.com/Vinicius-D-Lima/Adota-Pet

O conjunto corrigido é o business case em `EQUIPE_GERENCIA/business-case-final-adotapet.md` e o termo, o plano e o dicionário em `docs-gerencia/` (`termo-de-abertura-adotapet.md`, `plano-de-projeto-adotapet.md`, `dicionario-eap-adotapet.md`), com as figuras `cronograma-*.svg` da mesma pasta. `EQUIPE_GERENCIA/` repete plano e dicionário com o mesmo sumário. A pasta `docs/` tem outro plano, mais antigo, que não entrou nesta nota.

A nota é do Grupo I de GPTI e vale para cada aluno do grupo. Nesta etapa, a ausência de commit não zera ninguém. O nome na atividade do cronograma é o contrato da etapa seguinte. A especificação de referência é `docs/prototipagem-e-refinamento.md`: pet, compatibilidade, perfil, favoritos, questionário e solicitação de adoção, com `json-server` desde a rodada 3.

| Aluno | Nota |
| --- | ---: |
| Tamires Barbosa dos Santos | 89 |
| Pedro Pimentel Nunes | 89 |
| Beatriz Cardoso Abdias | 89 |
| Ana Isabel Matias da Silva Basilio | 89 |

## Parte comum — 89/100

| Parte | Nota |
| --- | ---: |
| Business case | 10/10 |
| Termo de abertura | 15/15 |
| Escopo e EAP | 15/15 |
| Cronograma com nomes | 21/25 |
| Custo, partes e riscos | 13/15 |
| Dicionário da EAP | 11/15 |
| Um projeto só | 4/5 |

### Business case — 10/10

O caso inclui consulta, busca, solicitação, análise e conclusão da adoção, API Express com MongoDB e login fictício, e deixa autenticação real e produção fora. Há alternativas e recomendação. A seção 12.1 diz que a viabilidade medida é a entrega acadêmica, e a 12.2 separa a estimativa de iniciação do termo (R$ 9.000, faixa −25% a +75%) da linha de base do plano (216 h, 56 h de contingência, R$ 7.276 com reserva).

### Termo de abertura — 15/15

O termo nomeia o patrocinador, o gerente Pedro Pimentel Nunes, a equipe de gestão e os três de PSW (Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira). A seção 2 diz que a GPTI acompanha os critérios e registra os aceites, com ciência do patrocinador. Incluído e fora listam os 17 casos de uso, perfil, favoritos, compatibilidade e questionário, com OAuth mockado e sem dado real.

### Escopo e EAP — 15/15

Os 17 casos, a compatibilidade, o perfil e os favoritos da prototipagem estão na declaração e na EAP (1.2 requisitos, 1.3 base técnica, 1.4 frontend, 1.5 API, 1.6 integração, 1.7 verificação). O pacote 1.3.6 trata os endpoints que permanecem no `json-server`, que a rodada 3 do refinamento introduziu.

### Cronograma com nomes — 21/25

A rede D01 a D14 e G01 a G07 tem predecessora, janela, duração, esforço e custo; o texto explica o caminho e a folga. As figuras `cronograma-gantt-psw-individual-adotapet.svg` e `cronograma-gantt-gpti-individual-adotapet.svg` põem, em cada pessoa, a atividade e as horas por semana: Igor, Marcos e Lucas em D01 a D14; Pedro, Ana Isabel, Beatriz e Tamires em G01 a G07.

Descontos:

- 2 pontos. Nas linhas de atividade, o responsável é a palavra "PSW" em D01 a D14 e "GPTI" em G01 a G07.
- 2 pontos. As tabelas 5.5 e 5.6 têm a hora de cada pessoa e uma coluna "Foco" única da semana ("CRUDs e seed", "Usuários, pets e catálogo"), sem a tarefa por pessoa. A tarefa só está na figura.

### Custo, partes e riscos — 13/15

Contingência de 56 h e reserva gerencial de R$ 476 separadas; o texto diz que o valor é econômico simulado. Riscos RG01, RG02 e seguintes com probabilidade, impacto em horas, mitigação e gatilho.

Descontos:

- 1 ponto. O responsável dos riscos é "Equipe GPTI" ou "Gerente do projeto", não um nome.
- 1 ponto. As oportunidades estão numa frase da seção 6.3 ("reutilizar componentes reduz retrabalho…"), sem entrada no registro, resposta ou dono.

### Dicionário da EAP — 11/15

O aceite é observável e é o do AdotaPet: "localizar pets fictícios, filtrar resultados e consultar detalhes"; "OAuth não chama provedor externo"; "não há dependência simulada apresentada como integração real". Pedro Pimentel Nunes é o A de todos os pacotes 1.1 e 1.2.

Descontos:

- 3 pontos. Nos pacotes de produto (1.3.x, 1.4.x e seguintes) o A é "Equipe PSW" e o R é "Equipe PSW", "Equipe GPTI" ou "Equipes GPTI e PSW". Nenhum pacote de produto tem uma pessoa que presta contas.
- 1 ponto. Ana Isabel, Beatriz e Tamires não aparecem no dicionário; a gestão inteira presta contas a Pedro.

### Um projeto só — 4/5

Caso, termo, plano de `docs-gerencia` e dicionário descrevem o mesmo produto, com os mesmos 17 casos.

Desconto:

- 1 ponto. O repositório guarda três planos: `docs-gerencia/`, `EQUIPE_GERENCIA/` (cópia "(2)") e `docs/plano-de-projeto.md`, com outro texto. Quem lê o repositório não sabe qual é a linha de base.

## O que esta nota deixa para a etapa seguinte

Pedro Pimentel Nunes presta contas dos pacotes 1.1 e 1.2 no dicionário. A figura individual de GPTI reparte G01 a G07 entre Pedro, Ana Isabel, Beatriz e Tamires, com horas. A figura de PSW reparte D01 a D14 entre Igor Pereira, Marcos Vinícius Silvestre e Lucas Ferreira. Várias dessas atividades aparecem no nome de mais de uma pessoa. A etapa seguinte cobra a atividade que a figura põe em cada nome. O dicionário, nos pacotes de produto, ainda presta contas a "Equipe PSW".
