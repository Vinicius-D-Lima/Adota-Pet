# Manual de instalação

Como colocar o AdotaPet para rodar em uma máquina nova, do zero até a primeira tela.

## 1. Pré-requisitos

| Item    | Versão                            | Como conferir    |
| ------- | --------------------------------- | ---------------- |
| Node.js | 22.12 ou superior (o CI usa a 22) | `node --version` |
| npm     | 10 ou superior                    | `npm --version`  |
| Git     | qualquer versão recente           | `git --version`  |
| Browser | Chrome, Edge ou Firefox           | versão atual     |

Para o dia a dia com `npm run dev:mock` não é preciso instalar banco: a API simulada (json-server) sobe junto com o frontend. Para usar a API real, instale e configure PostgreSQL (ver item 4).

## 2. Obter o código

```bash
git clone https://github.com/Vinicius-D-Lima/Adota-Pet.git
cd Adota-Pet
git checkout dev      # branch de integração; a main recebe da dev
```

## 3. Instalar as dependências

```bash
npm ci        # instala exatamente o que está no package-lock.json (recomendado)
# ou
npm install   # atualiza o lock se necessário
```

O `npm ci` instala os três workspaces (`apps/web`, `apps/api` e `packages/shared`). As principais dependências são React 18, Vite 6, TypeScript, **Tailwind CSS 4**, **react-hook-form** + Zod (em `@adotapet/shared`), TanStack Query, Express/Prisma e json-server. O detalhe está em [Arquitetura](arquitetura.md#stack).

## 4. Configurar o ambiente

Copie os exemplos (o do web é opcional no modo mock, porque o padrão já é `/api`):

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env   # somente para a API real
```

| Variável                | Padrão                  | Onde         | Descrição                                                    |
| ----------------------- | ----------------------- | ------------ | ------------------------------------------------------------ |
| `VITE_API_URL`          | `/api`                  | Frontend     | URL base da API. Troque para usar outra API                  |
| `VITE_API_PROXY_TARGET` | `localhost:3002`        | Frontend     | Destino do proxy; `dev:mock` ajusta para `localhost:3001`    |
| `MOCK_PORT`             | `3001`                  | API simulada | Porta do json-server                                         |
| `MOCK_DELAY_MS`         | `300`                   | API simulada | Latência simulada, em milissegundos                          |
| `DATABASE_URL`          | —                       | API real     | String de conexão do Postgres na nuvem (obrigatória)         |
| `TEST_DATABASE_URL`     | sufixo `_test`          | API real     | Banco de teste separado; nunca aponta os testes ao principal |
| `PORT`                  | `3002`                  | API real     | Porta do Express                                             |
| `CORS_ORIGIN`           | `http://localhost:5173` | API real     | Origens liberadas pelo CORS, separadas por vírgula           |
| `RATE_LIMIT_MAX`        | `100`                   | API real     | Requisições permitidas por janela                            |
| `RATE_LIMIT_WINDOW_MS`  | `60000`                 | API real     | Janela do rate limit, em ms                                  |
| `BODY_LIMIT`            | `100kb`                 | API real     | Limite do corpo JSON                                         |
| `LOG_LEVEL`             | `info`                  | API real     | Nível dos logs estruturados                                  |

O banco é gerenciado na nuvem (Neon), sem Docker. A API valida as variáveis na inicialização: se `DATABASE_URL` estiver ausente, ela encerra com uma mensagem que cita a variável. A URL de testes é derivada da principal por padrão (`.../adotapet` → `.../adotapet_test`) e o setup do Vitest cria e migra esse database separado.

## 5. Subir o projeto

```bash
npm run dev:mock
```

- Frontend: <http://localhost:5173>
- API simulada: <http://localhost:3001> (`dev:mock` aponta o proxy `/api` para ela, então não há CORS)

Na primeira execução o servidor cria `apps/web/mock-server/db.json` a partir de `apps/web/mock-server/db.seed.json`. Esse arquivo guarda favoritos, perfil e solicitações entre reinícios e **não vai para o git**.

### Rodando no GitHub Codespaces

O Codespace entrega o site por um endereço próprio (`https://<nome>-5173.app.github.dev`), e o Vite só aceitava `localhost`. Por isso o `apps/web/vite.config.ts` libera `*.app.github.dev`, e não é preciso configurar nada.

1. Confira o Node: `node --version`. Os testes (Vitest 5) exigem **22.12 ou superior**, e o Codespace padrão costuma vir com a 20. Se for menor, rode `nvm install 22 && nvm use 22`.
2. `npm ci` e `npm run dev:mock`, escolhendo o perfil quando ele perguntar.
3. Abra a porta **5173** na aba "Portas". A 3001 (API simulada) não precisa ser aberta, porque o Vite fala com ela por dentro do Codespace.
4. Se a página mostrar `Blocked request. This host is not allowed`, o endereço não é `*.app.github.dev` (por exemplo, outro serviço de nuvem). Libere-o em `server.allowedHosts` no `apps/web/vite.config.ts`, ou exporte `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.dominio.com` antes de subir.

## 6. Conferir a instalação

1. Abra <http://localhost:5173>: a página inicial deve mostrar os pets mais recentes.
2. Abra <http://localhost:3001/pets>: deve devolver `{ "data": [...], "total": 12 }`.
3. Rode a bateria completa (mesma ordem do CI):

```bash
npm run check:workspaces
npm run check:shared-imports
npm run check:deps
npm run check:contract
npm run db:generate
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## 7. Build de produção

```bash
npm run build            # shared → web → api; saídas em packages/shared/dist, apps/web/dist e apps/api/dist
npm run preview          # preview do Vite em http://localhost:4173
```

O `preview` também precisa da API simulada (`npm run mock` em outro terminal) ou da API real.

## 8. Publicação

O json-server é um processo Node, e hospedagens estáticas (Vercel, Netlify, GitHub Pages) **não o executam**. Para publicar um link:

1. Hospede a API simulada à parte (Render, Railway ou similar), com `npm run mock`.
2. Gere o frontend com `VITE_API_URL=https://sua-api.exemplo.com npm run build`.
3. Publique a pasta `apps/web/dist/` na hospedagem estática.

O CI **não faz deploy**: ele só valida (ver [Qualidade, testes e CI](qualidade-e-ci.md)).

## 9. Problemas comuns

| Sintoma                                                      | Causa provável                                    | O que fazer                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Página com `Blocked request. This host is not allowed` (403) | O Vite recusa endereços que não sejam `localhost` | No Codespaces já vem liberado; em outro ambiente, ver a seção do Codespaces |
| `EADDRINUSE` na porta 3001 ou 5173                           | Outra instância rodando                           | Encerre a outra instância ou use `MOCK_PORT=3101 npm run dev:mock`          |
| Telas em "Carregando…" para sempre                           | API simulada fora do ar                           | Rode `npm run dev:mock` (ou `npm run mock` em outro terminal)               |
| Perfil "incompleto" e erro 422 ao enviar solicitação         | `db.json` de uma versão antiga                    | `npm run mock:reset`                                                        |
| Dados estranhos depois de testar bastante                    | Estado acumulado em `db.json`                     | `npm run mock:reset`                                                        |
| `Unsupported engine` / erros de sintaxe no `npm ci`          | Node abaixo da versão 22                          | Instale o Node 22 (por exemplo com nvm: `nvm install 22`)                   |
| Estilos sumiram ou classes do Tailwind não aplicam           | Dependências desatualizadas depois de `pull`      | `npm ci` e reinicie o `npm run dev`                                         |
| Imagens dos pets não aparecem                                | Sem internet (as fotos são URLs externas)         | Conecte-se à internet; o resto do app funciona sem as fotos                 |
