# Testes: Testes de segurança dinâmicos noturnos (ZAP + Schemathesis)

> Issue [#98](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/98) · prefixo `DAST` · **5 testes** (0 funcionais, 2 de segurança, 3 de integração)

Garante varredura da API em execução com a especificação OpenAPI, fora do caminho crítico do PR.

## Como ler

Cada linha da tabela é uma verificação executada no CI ou na infraestrutura, e não um teste de unidade. O ID (por exemplo `DAST-01`) aparece no nome do passo do workflow ou do script que a executa, para que este documento, a issue e a automação se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo                     | O que verifica                              | Como é testado                                                  |
| --------- | ------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| `DAST-01` | Segurança · Configuração | ZAP baseline sem alertas MEDIUM ou maiores  | Contra a API em execução com banco de teste.                    |
| `DAST-02` | Segurança · Configuração | Schemathesis sem 5xx nem desvio do contrato | Gera casos a partir da OpenAPI e nenhuma resposta pode ser 5xx. |
| `DAST-03` | Integração               | Execução noturna e manual                   | Agendada e com `workflow_dispatch`; relatório anexado ao job.   |
| `DAST-04` | Integração               | Banco de teste isolado no job               | O job sobe a API com seed próprio e não toca em dados reais.    |
| `DAST-05` | Integração               | Falha abre alerta sem bloquear PR           | Cria issue ou notificação; não impede merges.                   |

Voltar ao [índice dos testes](README.md).
