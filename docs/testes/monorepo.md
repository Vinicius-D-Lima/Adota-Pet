# Testes: Monorepo (npm workspaces)

> Issue [#3](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/3) · prefixo `MONO` · **6 testes** (1 funcionais, 0 de segurança, 5 de integração)

Garante que `apps/web`, `apps/api` e `packages/shared` constroem juntos e que o contrato Zod é realmente compartilhado.

## Como ler

Cada linha da tabela é uma verificação executada no CI ou na infraestrutura, e não um teste de unidade. O ID (por exemplo `MONO-01`) aparece no nome do passo do workflow ou do script que a executa, para que este documento, a issue e a automação se encontrem pelo mesmo identificador.

## Testes

| ID        | Tipo       | O que verifica                              | Como é testado                                                                                                                       |
| --------- | ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `MONO-01` | Integração | `npm ci` na raiz instala os três workspaces | Em um clone limpo, `npm ci` termina sem erro e cria os links de `apps/web`, `apps/api` e `packages/shared` em `node_modules`.        |
| `MONO-02` | Integração | Build do web a partir da raiz               | `npm run build -w apps/web` gera `dist/` e o app abre sem erro de console.                                                           |
| `MONO-03` | Integração | O pacote `shared` é importado por web e api | Um schema Zod de `packages/shared` é importado pelos dois apps e o `typecheck` passa nos dois.                                       |
| `MONO-04` | Funcional  | Mudar o contrato quebra quem não acompanhou | Alterar um campo obrigatório no schema compartilhado faz o `typecheck` do app desatualizado falhar, provando que o contrato é único. |
| `MONO-05` | Integração | CI roda cada workspace                      | O workflow executa lint, typecheck, test e build para web e api, e falha se qualquer um falhar.                                      |
| `MONO-06` | Integração | Uma única versão das bibliotecas críticas   | `npm ls zod @casl/ability` mostra uma versão só, para evitar schemas incompatíveis entre os apps.                                    |

Voltar ao [índice dos testes](README.md).
