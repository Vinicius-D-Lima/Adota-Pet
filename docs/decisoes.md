# Decisões técnicas

Registro curto das escolhas que moldaram o projeto: o contexto, a decisão e a consequência. A ordem é aproximadamente cronológica.

## 1. Entregar só o frontend, com API simulada

- **Contexto:** o prazo é de entregar o frontend. O backend, a autenticação e a organização de ONGs vêm depois.
- **Decisão:** o frontend não depende de backend. Ele consome uma API REST simulada com **json-server** (`mock-server/`), com contrato, validação e erros próprios. Foi considerada a alternativa de interceptar as requisições no navegador (MSW); a escolha foi o json-server por ser um servidor de verdade, com persistência em arquivo.
- **Consequência:** o contrato do mock é o contrato que o backend real vai implementar. O frontend só precisa trocar `VITE_API_URL`. Em troca, é preciso hospedar o mock à parte para publicar um link (ver [Visão geral](visao-geral.md#publicar-o-frontend)).

## 2. TypeScript em modo `strict`

- **Decisão:** migrar todo o frontend de JavaScript para TypeScript (issue #2, PR #10), com `strict`, `noUnusedLocals` e `noUnusedParameters`.
- **Consequência:** erros de tipo aparecem no CI (`typecheck`). Foi também o que apontou incompatibilidades entre schemas e testes que o navegador e o Git não mostravam.

## 3. TanStack Query para o estado do servidor, Zod para o contrato

- **Decisão:** todo dado vindo da API fica no cache do TanStack Query (nada de `useState` + `useEffect` com `fetch`), e toda resposta é validada com um schema Zod. Os tipos TypeScript são **derivados** dos schemas.
- **Consequência:** uma única fonte de verdade para formato e tipo; contadores, corações e listas ficam sincronizados pelo mesmo cache; erros de contrato aparecem imediatamente.

## 4. O contrato é testado, não só descrito

- **Contexto:** a lista de solicitações ficou em "Carregando…" no navegador, mesmo com todos os testes unitários passando. O schema do pet embutido exigia `distanceKm`, que o servidor não manda nessa rota.
- **Decisão:** `requestPetSchema` omite `distance` e `distanceKm`, e `mock-server/contract.test.js` valida as respostas **reais** do servidor contra os schemas do frontend.
- **Consequência:** uma divergência entre mock e frontend vira um teste vermelho, e não um bug visual.

## 5. Filtros na URL

- **Decisão:** busca, filtros e ordenação ficam em `useSearchParams`, com valores validados contra uma lista permitida.
- **Consequência:** links compartilháveis, botão voltar funcional e nenhum estado perdido ao recarregar. O porte aceita vários valores com parâmetro repetido (`size=A&size=B`), padrão que o mock e o cliente HTTP entendem.

## 6. Favoritos otimistas, com fila

- **Decisão:** favoritar muda a tela na hora; as chamadas entram numa fila para chegarem ao servidor na ordem dos cliques; se uma falha, só aquele pet é desfeito e um aviso aparece; a ressincronização só acontece quando a fila esvazia.
- **Consequência:** a interface é rápida, e cliques rápidos não geram estado inconsistente.

## 7. Bloquear a duplicada antes, e manter o 409 como rede de segurança

- **Decisão:** o frontend esconde o botão de seguir e mostra um aviso quando já existe solicitação ativa para o pet. O servidor continua respondendo 409, e o frontend continua tratando esse erro.
- **Regra do redirecionamento do questionário:** só redireciona quem ainda não começou a preencher e com a lista já atualizada. Antes, qualquer lista que revelasse uma solicitação ativa tirava a pessoa da tela, o que perderia as respostas e atropelaria a ida para a confirmação (a solicitação recém-criada também conta como ativa).
- **Consequência:** a pessoa descobre cedo, sem perder trabalho, e o servidor continua sendo a fonte da verdade.

## 8. Cancelar pede confirmação

- **Decisão:** um modal acessível (`ConfirmDialog`) antes de cancelar. Foco inicial na opção segura, foco preso, Esc e clique fora fecham sem cancelar, e o resto da página fica inerte.
- **Consequência:** cancelamento deixou de ser irreversível por um clique. Depois de cancelar, o foco vai para o cartão, porque o botão de origem some junto com o status.

## 9. Erros e "não encontrado" explícitos

- **Decisão:** página 404 em vez de redirecionar silenciosamente para o início; telas próprias para pet e solicitação inexistentes; `ErrorBoundary` na raiz e por rota.
- **Consequência:** nenhuma URL errada ou erro de renderização termina em tela em branco ou em redirecionamento sem explicação.

## 10. Páginas sob demanda

- **Decisão:** `React.lazy` + `Suspense` em todas as páginas.
- **Consequência:** o bundle inicial diminuiu de cerca de 384 kB para 330 kB. Imagens fora da primeira dobra usam `loading="lazy"`, e todas têm `width` e `height`.

## 11. Biblioteca de componentes própria, sem framework de componentes

- **Decisão:** componentes em `src/components/ui` com props consistentes (`variant`, `size`, `loading`, `invalid`...). A variante `ghost` foi renomeada para `secondary`. Na época os estilos eram CSS puro; hoje são Tailwind (ver decisão 16).
- **Consequência:** telas mais curtas e uniformes. O custo foi converter todas as páginas, e quem escrever código novo deve usar os componentes (e não classes `button ...` soltas).

## 12. A compatibilidade é calculada no cliente

- **Decisão:** `calculateCompatibility` roda no navegador, com 7 critérios de peso igual.
- **Consequência:** simples e testável, sem rota no mock. Quando existir o serviço de matching no backend (#19), a tela passa a consumir o resultado da API.

## 13. Sem Next.js

- **Decisão:** manter React + Vite. A issue #7 (migração condicional para Next.js) foi encerrada como **não planejada**.
- **Consequência:** menos mudança de arquitetura antes do backend. Se um dia o servidor de renderização for necessário, a decisão pode ser reaberta.

## 14. Mesclar a `dev` na branch, nunca rebase

- **Decisão:** conflitos se resolvem trazendo a `dev` para a branch do PR (`git merge origin/dev`), sem reescrever histórico nem usar force-push.
- **Consequência:** quem já tem a branch no computador não perde nada. O PR de componentização (o mais invasivo) foi deixado por último na fila de mescla, para que o conflito fosse resolvido uma só vez.

## 15. Validar a mescla antes de mesclar

- **Contexto:** os PRs passavam no CI sozinhos, mas o CI roda sobre o resultado da mescla com a `dev`, e alguns problemas só apareciam depois que outro PR entrava (por exemplo, um teste que usava um pet com solicitação ativa e passou a ser redirecionado).
- **Decisão:** simular a sequência de mesclas, resolver os conflitos e rodar a bateria completa antes de mesclar, em vez de descobrir no CI.

## 16. Tailwind CSS em vez de CSS puro

- **Contexto:** o plano da disciplina pede um framework CSS de mercado, e o projeto tinha cerca de 2.400 linhas de CSS global em `styles.css` e `ui.css`. O pedido não dizia qual framework usar.
- **Decisão:** **Tailwind CSS 4**, pelo plugin `@tailwindcss/vite`, com as cores, as fontes e a sombra do projeto como tokens no `@theme` (`src/index.css`) e `tailwind-merge` para combinar classes. Alternativas consideradas: Bootstrap e Chakra UI (trazem componentes e visual prontos, o que obrigaria a refazer o layout; o Tailwind permite manter o desenho atual).
- **Consequência:** `styles.css` e `ui.css` deixaram de existir; as classes ficam no JSX; os breakpoints antigos (720, 820 e 920 px) foram consolidados em `md` (768 px) e `lg` (1024 px). Como o Tailwind redefine alguns padrões do navegador (altura de linha, margens de títulos e parágrafos), a camada `base` de `index.css` os restaura para manter o visual. A escolha é uma **suposição de quem executou a tarefa** e pode ser trocada em outra rodada.

## 17. react-hook-form nos formulários

- **Decisão:** o questionário e o perfil usam react-hook-form com `zodResolver`, reaproveitando os schemas Zod do contrato. `watch` foi trocado por `useWatch` (compatível com a regra `react-hooks/incompatible-library`), e as mensagens de "perfil atualizado" e de falha do envio são derivadas da identidade dos valores do formulário, e não de `useEffect`.
- **Consequência:** a validação por campo e o estado `isDirty` vêm da biblioteca, e `src/utils/zodFieldErrors.ts` foi removido. Erros 400 do servidor entram com `setError`. Os campos de seleção de sim ou não usam `setValueAs`, que também é aplicado aos valores iniciais e por isso aceita booleanos.

## 18. Seed com 12 pets e uma solicitação de cada status

- **Contexto:** o adotante só cria e cancela solicitações, e na primeira versão do mock nada levava uma solicitação a `Aprovada` ou `Recusada`. Esses status passaram a ser decididos pela instituição (PR #86), mas um exemplo de cada um continua útil na demonstração inicial.
- **Decisão:** o `db.seed.json` passou de 6 para 12 pets (a segunda página da listagem ficou útil) e traz as solicitações `SOL-1039` (`Aprovada`), `SOL-1040` (`Recusada`), `SOL-1041` (`Cancelada`) e `SOL-1042` (`Em análise`).
- **Consequência:** a próxima solicitação criada é a `SOL-1043`; os testes do servidor passaram a conferir o seed (12 pets, um de cada status e o 409 ao cancelar uma `Aprovada`).

## 19. Backend em Express, não em NestJS

- **Contexto:** a issue #47 recomendava NestJS (módulos, injeção de dependências e Swagger prontos). A equipe é pequena, o prazo é curto e os schemas Zod do frontend já existem.
- **Decisão:** **Express**, com a estrutura de pastas por módulo definida na #47 e Zod para validação, reaproveitando os schemas do pacote compartilhado.
- **Consequência:** menos conceitos novos e nenhuma cerimônia, mas a organização (camadas, validação, tratamento de erros, guards) é montada à mão. As issues #28, #47 e #48 foram reescritas sem as referências ao NestJS (`@Roles`, `@CurrentUser`, `@nestjs/*`).

## 20. PostgreSQL, não MongoDB

- **Contexto:** o plano de gerência, o business case e o dicionário da EAP citam **MongoDB**. O backlog de issues (#18 a #51) descreve um modelo muito relacional: organizações, membros com papéis, solicitações com histórico, adoções, check-ins, avaliações e denúncias.
- **Decisão:** **PostgreSQL**, porque regras como "uma solicitação ativa por pet e adotante" (índice único parcial), "aprovar cria exatamente uma adoção" (transação) e "a organização tem ao menos um administrador" ficam garantidas pelo banco.
- **Consequência:** os documentos de gerência ainda dizem MongoDB (pacotes 1.3.3 e 1.5.8 do dicionário da EAP). A atualização deles cabe à equipe de gerência, e a divergência está registrada aqui.

## 21. Prisma com migrations

- **Decisão:** **Prisma** como ORM, com migrations versionadas, tipos TypeScript gerados e seed. O `@casl/prisma` usa os mesmos modelos para filtrar as consultas.
- **Consequência:** consultas muito complexas podem exigir SQL bruto (`$queryRaw`), sempre parametrizado.

## 22. Autenticação com JWT curto e refresh rotacionado em cookie httpOnly

- **Decisão:** access token JWT de cerca de 15 minutos, enviado em `Authorization: Bearer` e guardado só em memória no frontend. Refresh token de cerca de 7 dias em cookie `httpOnly`, `Secure` e `SameSite`, rotacionado a cada uso e guardado no banco só como hash. Senha com argon2.
- **Consequência:** o reuso de um refresh antigo derruba a cadeia inteira de tokens do usuário. É o modelo mais trabalhoso de acertar, por isso a #48 traz 16 testes obrigatórios (ver [Testes do backend](testes/README.md)).

## 23. Permissões com CASL

- **Decisão:** **CASL** (`@casl/ability` e `@casl/prisma`), com negação por padrão e a matriz de permissões da #28 como fonte da verdade.
- **Consequência:** as regras "só dentro da minha organização" viram condições do CASL, e as listagens usam `accessibleBy` para nunca devolver registros de outra organização. O frontend pode reaproveitar as mesmas regras.

## 24. Arquivos pela API do S3, com SeaweedFS no Docker

- **Contexto:** a issue #24 sugeria o MinIO. A edição comunitária do MinIO deixou de publicar imagens Docker em outubro de 2025 e entrou em modo de manutenção em dezembro de 2025.
- **Decisão:** o código usa a API do S3 (`@aws-sdk/client-s3`), e o ambiente local roda o **SeaweedFS** (Apache-2.0). Fotos e anexos passam por um módulo único (#94), com bucket privado e URLs assinadas.
- **Consequência:** trocar para Cloudflare R2 ou S3 é só mudar variáveis de ambiente, sem alterar código.

## 25. Jobs em segundo plano com pg-boss

- **Decisão:** **pg-boss** (MIT), que usa o próprio PostgreSQL como fila, sem Redis. Cobre retentativa, agendamento, dead letter e enfileirar na mesma transação dos dados (#95).
- **Consequência:** nenhum serviço a mais para manter. Em troca, a fila usa o mesmo banco; neste tamanho de projeto isso não pesa. BullMQ com Redis continua uma saída se a carga crescer.

## 26. Monorepo com npm workspaces

- **Decisão:** `apps/web`, `apps/api` e `packages/shared`, este último com os schemas Zod compartilhados entre frontend e backend (#3).
- **Consequência:** o contrato de dados passa a ser único: mudar um campo obrigatório no pacote compartilhado quebra o `typecheck` de quem não acompanhou.

## 27. Testes do backend com Vitest e supertest, catalogados por ID

- **Decisão:** Vitest e supertest contra um Postgres real de teste. Cada teste tem um ID (por exemplo `AUTH-07`) que aparece no nome do teste e em um documento por módulo em [`docs/testes/`](testes/README.md). Cada issue de backend traz uma seção "Testes obrigatórios" com os seus IDs.
- **Consequência:** são 238 testes catalogados (112 de segurança). O catálogo é a especificação, escrita antes do código, e precisa ser mantida em dia.

## 28. Docker para o projeto inteiro, com Hadolint e Trivy

- **Decisão:** web, api, banco, storage e e-mail de desenvolvimento (Mailpit) sobem com `docker compose` (#96). O **Hadolint** revisa os Dockerfiles e o **Trivy** varre imagens e configuração; o CI falha em vulnerabilidades **HIGH** e **CRITICAL que já tenham correção disponível**.
- **Consequência:** vulnerabilidades sem correção não bloqueiam, para não travar o projeto por algo que ninguém consegue resolver. Elas aparecem no relatório.

## 29. Segurança no pipeline

- **Decisão:** Dependabot, `npm audit`, Gitleaks, CodeQL, permissões mínimas no workflow e actions fixadas por SHA (#97), mais ZAP e Schemathesis em execução noturna (#98).
- **Consequência:** o que roda em todo PR é rápido e grátis. Os testes dinâmicos, mais lentos, rodam à noite para não atrasar os PRs.

## Decisão pendente: acessibilidade

O trabalho de acessibilidade (#57) foi mesclado e depois **revertido** (PR #82). Ele não está na `dev`. Veja [Histórico](historico.md#o-revert-da-acessibilidade-81-e-82) e [Roadmap](roadmap.md#acessibilidade-57).
