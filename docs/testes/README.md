# Testes do backend

Catálogo dos testes que o backend do AdotaPet deve ter, com **238 testes** em 26 módulos (107 funcionais, 112 de segurança e 19 de integração ou infraestrutura). Cada teste tem um ID estável e uma explicação do que prova e de como é feito.

> **Estado:** o backend ainda não existe. Este catálogo é a **especificação** dos testes, escrita antes do código, e cada issue de backend traz a lista dos seus testes em uma seção "Testes obrigatórios". Conforme os testes forem implementados, a coluna "Como é testado" deve ser mantida em dia.

## Convenção

- **ID:** prefixo do módulo e número com dois dígitos, por exemplo `AUTH-07`. O ID nunca é reaproveitado: se um teste for removido, o número fica vago.
- **No código:** o nome do teste começa com o ID entre colchetes, por exemplo `it('[AUTH-07] rejeita JWT com alg none', ...)`. Assim `grep "\[AUTH-07\]"` acha o teste e o documento.
- **Ferramentas:** Vitest e supertest para a API, com o Postgres de teste do Docker. Nada de mocks do banco: os testes de segurança de autorização só valem se a consulta real rodar.
- **Tipos:** _Funcional_ (regra de negócio), _Segurança_ (tenta quebrar a regra de acesso, de dado ou de entrada) e _Integração_ (infraestrutura e pipeline).
- **Segurança sempre com a tentativa de ataque:** o teste faz o que um atacante faria (usa o id de outro usuário, adultera o token, envia o payload de injeção) e confere que a API nega.
- **Como adicionar um teste:** acrescente a linha ao arquivo do módulo com o próximo número livre, escreva o teste com o ID no nome e atualize a seção "Testes obrigatórios" da issue.

## Módulos

| Módulo                                                                 | Issue                                                         | Prefixo | Funcionais | Segurança | Integração |   Total |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- | ------- | ---------: | --------: | ---------: | ------: |
| [Monorepo (npm workspaces)](monorepo.md)                               | [#3](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/3)   | `MONO`  |          1 |         0 |          5 |       6 |
| [Banco PostgreSQL em Docker](banco.md)                                 | [#9](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/9)   | `DB`    |          0 |         2 |          5 |       7 |
| [Padrões transversais da API](infra-api.md)                            | [#47](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/47) | `INF`   |          4 |         7 |          1 |      12 |
| [Usuários e autenticação](auth.md)                                     | [#48](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/48) | `AUTH`  |          5 |        11 |          0 |      16 |
| [Perfil do adotante](perfil.md)                                        | [#18](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/18) | `PERF`  |          5 |         3 |          0 |       8 |
| [CRUD de pets](pets.md)                                                | [#49](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/49) | `PET`   |          7 |         5 |          0 |      12 |
| [Favoritos](favoritos.md)                                              | [#51](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/51) | `FAV`   |          5 |         2 |          0 |       7 |
| [Criação e leitura de solicitações](solicitacoes.md)                   | [#50](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/50) | `REQ`   |          6 |         4 |          0 |      10 |
| [Máquina de estados da solicitação](maquina-estados.md)                | [#20](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/20) | `FSM`   |          7 |         4 |          0 |      11 |
| [Agendamento de entrevista e visita](agendamento.md)                   | [#21](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/21) | `AGD`   |          7 |         2 |          0 |       9 |
| [Chat da solicitação](chat.md)                                         | [#22](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/22) | `CHAT`  |          4 |         5 |          0 |       9 |
| [Matching e ranking de compatibilidade](matching.md)                   | [#19](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/19) | `MATCH` |          7 |         2 |          0 |       9 |
| [Adoção e plano de acompanhamento](adocao.md)                          | [#23](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/23) | `ADOC`  |          5 |         3 |          0 |       8 |
| [Check-ins pós-adoção com fotos](checkins.md)                          | [#24](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/24) | `CHK`   |          3 |         7 |          0 |      10 |
| [Avaliações e reputação](reputacao.md)                                 | [#25](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/25) | `REV`   |          6 |         3 |          0 |       9 |
| [Denúncias e moderação](denuncias.md)                                  | [#26](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/26) | `DEN`   |          4 |         5 |          0 |       9 |
| [Organizações, membros e convites](organizacoes.md)                    | [#27](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/27) | `ORG`   |          5 |         4 |          0 |       9 |
| [Papéis e permissões (CASL)](rbac.md)                                  | [#28](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/28) | `RBAC`  |          1 |         8 |          0 |       9 |
| [Prontuário médico do pet](prontuario.md)                              | [#29](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/29) | `PRO`   |          4 |         5 |          0 |       9 |
| [Notificações](notificacoes.md)                                        | [#30](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/30) | `NOT`   |          6 |         3 |          0 |       9 |
| [Filtros salvos e alertas](filtros-salvos.md)                          | [#31](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/31) | `FIL`   |          7 |         2 |          0 |       9 |
| [Armazenamento de arquivos (API S3 + SeaweedFS)](armazenamento.md)     | [#94](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/94) | `STO`   |          2 |         6 |          1 |       9 |
| [Fila de jobs (pg-boss)](fila-jobs.md)                                 | [#95](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/95) | `JOB`   |          6 |         1 |          1 |       8 |
| [Docker do projeto inteiro (Hadolint + Trivy)](docker.md)              | [#96](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/96) | `DOCK`  |          0 |         7 |          3 |      10 |
| [Pipeline de segurança no CI](seguranca-ci.md)                         | [#97](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/97) | `SEC`   |          0 |         9 |          0 |       9 |
| [Testes de segurança dinâmicos noturnos (ZAP + Schemathesis)](dast.md) | [#98](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/98) | `DAST`  |          0 |         2 |          3 |       5 |
| **Total**                                                              |                                                               |         |    **107** |   **112** |     **19** | **238** |

## Matriz de segurança

Os testes de segurança agrupados pelo tipo de falha que eles tentam provocar. As referências ajudam a orientar a leitura e **não** são uma certificação.

| Categoria              | Referência                                                            | Testes | IDs                                                                                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BOLA/IDOR              | OWASP API Security Top 10 (2023) API1: autorização no nível do objeto |     24 | `PERF-04`, `PET-07`, `FAV-04`, `REQ-05`, `FSM-04`, `AGD-09`, `CHAT-01`, `CHAT-09`, `MATCH-09`, `ADOC-07`, `CHK-05`, `CHK-10`, `DEN-09`, `ORG-08`, `RBAC-03`, `RBAC-05`, `RBAC-07`, `PRO-06`, `PRO-09`, `NOT-03`, `FIL-06`, `STO-02`, `STO-03`, `STO-06` |
| Autorização por função | OWASP API Top 10 (2023) API5: autorização no nível da função          |     14 | `PET-06`, `FSM-03`, `AGD-05`, `ADOC-04`, `CHK-04`, `REV-01`, `DEN-02`, `ORG-06`, `RBAC-01`, `RBAC-02`, `RBAC-04`, `RBAC-06`, `RBAC-08`, `PRO-05`                                                                                                        |
| Autenticação           | OWASP API Top 10 (2023) API2: autenticação quebrada                   |     12 | `AUTH-05`, `AUTH-08`, `AUTH-09`, `AUTH-10`, `AUTH-11`, `AUTH-12`, `AUTH-13`, `PERF-06`, `FAV-05`, `ORG-04`, `ORG-05`, `NOT-09`                                                                                                                          |
| Configuração           | OWASP API Top 10 (2023) API8: configuração incorreta de segurança     |     11 | `DB-04`, `INF-03`, `INF-04`, `INF-05`, `DOCK-04`, `DOCK-05`, `DOCK-09`, `SEC-05`, `SEC-07`, `DAST-01`, `DAST-02`                                                                                                                                        |
| Upload                 | OWASP File Upload Cheat Sheet                                         |      9 | `PET-10`, `CHK-01`, `CHK-02`, `CHK-03`, `CHK-06`, `DEN-08`, `STO-04`, `STO-05`, `STO-09`                                                                                                                                                                |
| Cadeia de suprimentos  | OWASP Top 10 (2021) A06: componentes vulneráveis e desatualizados     |      8 | `DOCK-02`, `DOCK-03`, `DOCK-07`, `SEC-01`, `SEC-02`, `SEC-04`, `SEC-06`, `SEC-09`                                                                                                                                                                       |
| Exposição de dados     | OWASP API Top 10 (2023) API3: exposição excessiva de dados            |      7 | `INF-08`, `AUTH-04`, `AUTH-16`, `CHAT-07`, `DEN-01`, `PRO-04`, `JOB-06`                                                                                                                                                                                 |
| Limite de uso          | OWASP API Top 10 (2023) API4: consumo irrestrito de recursos          |      6 | `INF-06`, `INF-07`, `AUTH-06`, `CHAT-08`, `MATCH-08`, `DEN-05`                                                                                                                                                                                          |
| Mass assignment        | OWASP API Top 10 (2023) API3: autorização no nível da propriedade     |      6 | `AUTH-14`, `PERF-05`, `PET-08`, `REQ-06`, `REV-09`, `PRO-03`                                                                                                                                                                                            |
| XSS                    | OWASP Top 10 (2021) A03: injeção (XSS)                                |      5 | `REQ-09`, `FSM-10`, `CHAT-06`, `REV-08`, `NOT-07`                                                                                                                                                                                                       |
| Segredos               | CWE-798: credenciais embutidas no código                              |      4 | `DB-03`, `DOCK-06`, `SEC-03`, `SEC-08`                                                                                                                                                                                                                  |
| Injeção                | OWASP Top 10 (2021) A03: injeção                                      |      3 | `INF-11`, `PET-09`, `FIL-07`                                                                                                                                                                                                                            |
| Concorrência           | Lógica de negócio: condição de corrida                                |      3 | `REQ-07`, `FSM-09`, `ADOC-08`                                                                                                                                                                                                                           |

## O que estes testes não cobrem

- Eles pegam as falhas que o catálogo descreve. Uma falha que ninguém imaginou continua possível, e por isso o pipeline de segurança ([#97](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/97)) e os testes dinâmicos noturnos ([#98](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/98)) complementam este catálogo.
- Não substituem uma revisão manual de código nem um teste de invasão feito por uma pessoa antes de um uso real.
- Os testes do frontend (Vitest e Testing Library) estão descritos em [Qualidade, testes e CI](../qualidade-e-ci.md) e não fazem parte deste catálogo.
