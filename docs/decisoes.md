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

## 11. Biblioteca de componentes própria, sem framework de UI

- **Decisão:** componentes em `src/components/ui` com props consistentes (`variant`, `size`, `loading`, `invalid`...), em CSS puro. A variante `ghost` foi renomeada para `secondary`.
- **Consequência:** telas mais curtas e uniformes, sem dependência nova. O custo foi converter todas as páginas, e quem escrever código novo deve usar os componentes (e não classes `button ...` soltas).

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

## Decisão pendente: acessibilidade

O trabalho de acessibilidade (#57) foi mesclado e depois **revertido** (PR #82). Ele não está na `dev`. Veja [Histórico](historico.md#o-revert-da-acessibilidade-81-e-82) e [Roadmap](roadmap.md#acessibilidade-57).
