# Testes: Prontuário médico do pet

> Issue [#29](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/29) · prefixo `PRO` · **9 testes** (4 funcionais, 5 de segurança, 0 de integração)

Garante campos derivados corretos e a separação entre visão pública e visão completa dos dados de saúde.

## Como ler

Cada linha da tabela é um teste de `apps/api`, escrito com Vitest e supertest contra o Postgres de teste. O nome do teste no código começa com o ID entre colchetes, por exemplo `it('[PRO-01] ...')`, para que este documento, a issue e o código se encontrem pelo mesmo identificador.

## Testes

| ID       | Tipo                               | O que verifica                                         | Como é testado                                                           |
| -------- | ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `PRO-01` | Funcional                          | `vaccinated`, `neutered` e `specialCare` são derivados | Calculados a partir do prontuário.                                       |
| `PRO-02` | Funcional                          | Vacina vencida desfaz `vaccinated`                     | Com `nextDoseAt` no passado, vira `false`.                               |
| `PRO-03` | Segurança · Mass assignment        | Campos derivados não são editáveis à mão               | Enviar `vaccinated: true` no corpo é ignorado.                           |
| `PRO-04` | Segurança · Exposição de dados     | Visão pública não expõe anexos nem observações         | Só membros e adotantes com solicitação ativa veem a visão completa.      |
| `PRO-05` | Segurança · Autorização por função | Só membros da organização do pet editam                | Outros recebem 403.                                                      |
| `PRO-06` | Segurança · BOLA/IDOR              | Anexos de exames só por URL assinada                   | Quem não tem vínculo recebe 403.                                         |
| `PRO-07` | Funcional                          | Auditoria de alterações                                | Registra quem criou ou alterou cada item e quando.                       |
| `PRO-08` | Funcional                          | Seed coerente com os booleanos atuais                  | Cada pet do seed gera prontuário que resulta nos mesmos valores de hoje. |
| `PRO-09` | Segurança · BOLA/IDOR              | Exames e vacinas de outro pet                          | Acessar o item de um pet alheio pelo id retorna 403 ou 404.              |

Voltar ao [índice dos testes](README.md).
