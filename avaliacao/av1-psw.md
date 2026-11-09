# Correção da AV1 — PSW — AdotaPet

Repositório: https://github.com/Vinicius-D-Lima/Adota-Pet

A nota de cada aluno é a parte comum do grupo mais a qualidade individual. Sem autoria efetiva na própria parte, a AV1 fica 0. A parte comum vale 60 pontos: stack da disciplina (30) e escopo funcionando (30). Os 40 restantes avaliam a qualidade do que o próprio aluno fez.

| Aluno | Nota |
| --- | ---: |
| Igor Pereira Affonso | 100 |
| Lucas Ferreira de Paula | 100 |
| Marcos Vinicius Silvestre de Lima | 100 |

A nota do Marcos depende de a conta `Vinicius-D-Lima` ser dele. O trecho dele, abaixo, deixa a outra leitura.

## Parte comum — 60/60

A correção usou a branch `main`. O README sobe tudo com `npm run dev:mock`, e esse script pergunta no terminal qual perfil abrir. Subi o mock na porta 3001 com `npm run mock` e o Vite com `VITE_DEMO_USER_ID`. O adotante `demo` ficou em `http://127.0.0.1:5173`. O instituto `demo-organization` ficou em `http://127.0.0.1:5175`. O `npm install` avisou que `jsdom`, `vitest` e `concurrently` preferem Node 22. Com o Node 20 desta máquina, a API e as duas telas atenderam.

A conta de demonstração entra pelo cabeçalho `X-Demo-User-Id`. O adotante do seed é Lucas Ferreira, `demo@adotapet.local`. O instituto é o Instituto Patinhas.

A stack vale 30/30.

- 5 pontos. React com rotas para a lista, a ficha, o questionário, as solicitações, os favoritos, o perfil e a área do instituto (`/organizacao/pets`, `/novo` e `/:petId/editar`).
- 5 pontos. React Hook Form com `zodResolver` no questionário, no perfil, no pet do instituto, no perfil do responsável e na criação de conta.
- 5 pontos. Zod valida esses formulários.
- 5 pontos. TanStack Query 5 grava com `useMutation` em favoritos, solicitações, perfil do adotante, perfil do responsável e pets do instituto.
- 5 pontos. A API sobe com `npm run mock`. O servidor é o `mock-server/server.js`, em cima do JSON Server 0.17.4.
- 5 pontos. Tailwind 4 entra pelo plugin do Vite.

O escopo vale 30/30. A régua é `docs/prototipagem-e-refinamento.md`, com `docs/funcionalidades.md` e `docs/escopo-prometido-vs-entregue.md`. O fluxo pedido é o do adotante. A área do instituto fica além desse texto e entra porque o piso da disciplina é uma entidade com cadastro, consulta, alteração e exclusão por aluno. Aprovar ou recusar solicitação fica de fora: o documento de escopo marca essa decisão como semente, fora da entrega.

- 8 pontos, pet. O filtro Gato em `/pets?species=Gato` mostrou Mimi, Nina, Simba e Pipoca. No instituto, o cadastro gravou o pet `mel-av1`, "Mel AV1". A edição gravou o resumo "Cadela calma editada na AV1" e `GET /pets/mel-av1` devolveu esse texto. A exclusão devolveu 404, e a lista do instituto ficou Luna, Fred e Maya.
- 8 pontos, solicitação. O questionário do Bento criou `SOL-1043` com status Enviada, e a confirmação abriu `/solicitacoes/SOL-1043/enviada`. O cancelamento, no diálogo da própria página, gravou Cancelada.
- 7 pontos, favorito. Favoritar a Mimi gravou o id `mimi` em `GET /me/favorites/ids`. Remover na página de favoritos deixou só `luna`.
- 7 pontos, perfil. O telefone passou de `11987654321` para `11999990000`. O `GET /me/adopter-profile` devolveu o número novo e o nome Lucas Ferreira.

Os commits de Beatriz Cardoso Abdias e de Ana Isabel Matias da Silva Basilio são documentos de GPTI. Os commits de Claude e de `sim@example.com` ficam de fora da nota individual. O que esses commits entregam e a aplicação executa continua na parte comum.

## Igor Pereira Affonso — 100

A área do instituto, o ajuste da consulta à API, a entrada de TanStack Query e Zod no perfil e o ícone com as iniciais estão nos commits `8668117`, `2deef45`, `dfc9961`, `abf409f` e `3d25e58`, nos autores Igor e IgorAffonsoIA, com o e-mail `igorp.affonso@gmail.com`. A nota reúne os 60 pontos do grupo e 40 de qualidade.

O cadastro, a edição e a exclusão de Mel AV1 passaram pela área que esse commit criou e continuaram na API.

## Lucas Ferreira de Paula — 100

A ordenação por compatibilidade, o percentual nos cartões e as recomendações da página inicial estão nos quatro commits dele, de `2707435` a `58b08cb`, com o e-mail `lucasferreira9569@gmail.com`. A nota reúne os 60 pontos do grupo e 40 de qualidade.

A página inicial do adotante `demo` abriu "Recomendados para você", com Luna, Mimi e Tobias e o texto de compatibilidade em cada cartão.

## Marcos Vinicius Silvestre de Lima — 100

A nota da tabela considera que a conta `Vinicius-D-Lima`, dona do repositório, é o Marcos. Os 36 commits com o e-mail `mv04126@gmail.com` incluem o JSON Server, o cliente da API, os favoritos, as solicitações e a persistência do perfil. Favoritar e remover a Mimi, criar e cancelar `SOL-1043` e gravar o telefone `11999990000` passaram por essa parte. Com essa leitura, a nota reúne os 60 pontos do grupo e 40 de qualidade.

O perfil dessa conta no GitHub está sem nome. O commit `3c7eabf`, "Fix/PetDetailpage", usa o e-mail `marcosviniciusdelima45@gmail.com` e o nome de autor `Vinicius-d-lima`. Outro commit antigo, `4014a5b`, "Fix/migrate-npm", usa o mesmo nome de autor e o e-mail do laboratório `aluno@PAV1LAB1-117055.rg.cefet-rj.br`.

Se a conta `Vinicius-D-Lima` for de outra pessoa, a AV1 do Marcos fica 0. O único commit com o e-mail dele é o ajuste da ficha do pet, e o produto que a correção executou está no outro autor. Esta nota fica aberta até essa confirmação.
