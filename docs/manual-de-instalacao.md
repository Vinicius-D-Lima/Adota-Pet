# Manual de instalação

Como colocar o AdotaPet para rodar em uma máquina nova, do zero até a primeira tela.

## 1. Pré-requisitos

| Item    | Versão                   | Como conferir    |
| ------- | ------------------------ | ---------------- |
| Node.js | 22 (a mesma usada no CI) | `node --version` |
| npm     | 10 ou superior           | `npm --version`  |
| Git     | qualquer versão recente  | `git --version`  |
| Browser | Chrome, Edge ou Firefox  | versão atual     |

Não é preciso instalar banco de dados nem backend: a API é simulada (json-server) e sobe junto com o frontend.

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

As principais dependências são React 18, Vite 6, TypeScript, **Tailwind CSS 4**, **react-hook-form** + Zod, TanStack Query e json-server. O detalhe está em [Arquitetura](arquitetura.md#stack).

## 4. Configurar o ambiente

Copie o exemplo (opcional no modo mock, porque o valor padrão já é `/api`):

```bash
cp .env.example .env
```

| Variável        | Padrão | Onde         | Descrição                                   |
| --------------- | ------ | ------------ | ------------------------------------------- |
| `VITE_API_URL`  | `/api` | Frontend     | URL base da API. Troque para usar outra API |
| `MOCK_PORT`     | `3001` | API simulada | Porta do json-server                        |
| `MOCK_DELAY_MS` | `300`  | API simulada | Latência simulada, em milissegundos         |

## 5. Subir o projeto

```bash
npm run dev:mock
```

- Frontend: <http://localhost:5173>
- API simulada: <http://localhost:3001> (o Vite faz proxy de `/api`, então não há CORS)

Na primeira execução o servidor cria `mock-server/db.json` a partir de `mock-server/db.seed.json`. Esse arquivo guarda favoritos, perfil e solicitações entre reinícios e **não vai para o git**.

## 6. Conferir a instalação

1. Abra <http://localhost:5173>: a página inicial deve mostrar os pets mais recentes.
2. Abra <http://localhost:3001/pets>: deve devolver `{ "data": [...], "total": 12 }`.
3. Rode a bateria completa (mesma ordem do CI):

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## 7. Build de produção

```bash
npm run build      # checagem de tipos + build do Vite, saída em dist/
npm run preview    # serve o build em http://localhost:4173
```

O `preview` também precisa da API simulada (`npm run mock` em outro terminal).

## 8. Publicação

O json-server é um processo Node, e hospedagens estáticas (Vercel, Netlify, GitHub Pages) **não o executam**. Para publicar um link:

1. Hospede a API simulada à parte (Render, Railway ou similar), com `npm run mock`.
2. Gere o frontend com `VITE_API_URL=https://sua-api.exemplo.com npm run build`.
3. Publique a pasta `dist/` na hospedagem estática.

O CI **não faz deploy**: ele só valida (ver [Qualidade, testes e CI](qualidade-e-ci.md)).

## 9. Problemas comuns

| Sintoma                                              | Causa provável                               | O que fazer                                                        |
| ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `EADDRINUSE` na porta 3001 ou 5173                   | Outra instância rodando                      | Encerre a outra instância ou use `MOCK_PORT=3002 npm run dev:mock` |
| Telas em "Carregando…" para sempre                   | API simulada fora do ar                      | Rode `npm run dev:mock` (ou `npm run mock` em outro terminal)      |
| Perfil "incompleto" e erro 422 ao enviar solicitação | `db.json` de uma versão antiga               | `npm run mock:reset`                                               |
| Dados estranhos depois de testar bastante            | Estado acumulado em `db.json`                | `npm run mock:reset`                                               |
| `Unsupported engine` / erros de sintaxe no `npm ci`  | Node abaixo da versão 22                     | Instale o Node 22 (por exemplo com nvm: `nvm install 22`)          |
| Estilos sumiram ou classes do Tailwind não aplicam   | Dependências desatualizadas depois de `pull` | `npm ci` e reinicie o `npm run dev`                                |
| Imagens dos pets não aparecem                        | Sem internet (as fotos são URLs externas)    | Conecte-se à internet; o resto do app funciona sem as fotos        |
