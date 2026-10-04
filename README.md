# AdotaPet Frontend

Protótipo funcional em React + TypeScript do fluxo principal de adoção responsável do AdotaPet. Todos os dados são locais e ficam em variáveis/estado dos componentes, sem API ou banco de dados.

## Fluxo implementado

1. Página inicial e apresentação do produto
2. Pesquisa e filtros de pets
3. Detalhes e necessidades do animal
4. Compatibilidade com o perfil do adotante
5. Questionário de adoção com validação
6. Envio e confirmação da solicitação
7. Acompanhamento e cancelamento de solicitações
8. Edição do perfil usado na compatibilidade

## Executar

O app consome uma API REST simulada com [json-server](https://github.com/typicode/json-server) 0.17 (`mock-server/`). Um único comando sobe o frontend (Vite) e o mock:

```bash
npm install
npm run dev:mock
```

- Frontend: http://localhost:5173 · API simulada: http://localhost:3001 (o Vite faz proxy de `/api` → `http://localhost:3001`, sem CORS).
- `VITE_API_URL=/api` (veja `.env.example`). Para apontar para outra API, basta trocar essa variável.
- `npm run mock` sobe só o mock; `npm run dev` sobe só o Vite.
- `MOCK_DELAY_MS` (padrão `300`) controla a latência simulada; `MOCK_PORT` (padrão `3001`) muda a porta.

### Dados do mock

- `mock-server/db.seed.json` é o seed versionado. Na primeira execução ele é copiado para `mock-server/db.json` (ignorado pelo git), que guarda favoritos, perfil e solicitações entre recarregamentos e reinícios.
- `npm run mock:reset` copia o seed sobre o `db.json`, voltando aos dados originais.
- **Já tinha um `mock-server/db.json` de uma versão anterior?** Rode `npm run mock:reset`. Sem o reset o servidor sobe normalmente, mas o perfil aparece com `isComplete: false` e os campos novos (`cpf`, `birthDate`, `email`, `phone`, `zipCode`, `address`) em `missingFields`, e `POST /requests` responde 422 até o perfil ser preenchido.

### Contrato da API simulada

| Rota                                                     | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /pets?search&species&size&sex&city&sort&page&limit` | `{ data, total }`; `sort` = `recent` \| `name` \| `distance`. Só esses parâmetros são aceitos: qualquer outro (ex.: `lat`) retorna **400** com `details: [{ field, message: "Parâmetro desconhecido" }]`. `sort=distance` é calculado em relação às coordenadas fixas do usuário demo (não há geolocalização do navegador).                                                                                                                                                     |
| `GET /pets/:id`                                          | Pet (404 se não existir)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `GET /me`                                                | Usuário de demonstração fixo                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET /me/adopter-profile`                                | Perfil + `isComplete` (`true` só com todos os campos válidos) + `missingFields` (ex.: `["cpf", "address"]`)                                                                                                                                                                                                                                                                                                                                                                     |
| `PUT /me/adopter-profile`                                | Atualização parcial. Campos: `name`, `cpf`, `birthDate` (`YYYY-MM-DD`, 18+), `email`, `phone`, `zipCode`, `address`, `housing`, `dailyTime`, `activityLevel`, `experience`, `preferredSpecies`, `preferredSize` e os booleanos `hasOutdoorArea`, `hasChildren`, `hasOtherPets`, `acceptsSpecialCare`. `cpf`, `phone` e `zipCode` aceitam máscara e são guardados só com dígitos. Valores inválidos retornam **400** com `details` por campo; texto vazio (`""`) limpa um campo. |
| `POST /requests`                                         | Cria solicitação (ID e data gerados pelo servidor). Perfil incompleto retorna **422** com `details: [{ field, message }]` listando os campos de `missingFields`.                                                                                                                                                                                                                                                                                                                |
| `GET /me/requests`, `GET /requests/:id`                  | Solicitações do usuário                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `POST /requests/:id/transitions`                         | `{ "to": "CANCELADA" }`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `GET /me/favorites`, `GET /me/favorites/ids`             | Favoritos (pets completos / só IDs)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PUT/DELETE /me/favorites/:petId`                        | Adiciona / remove favorito (204)                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Erros seguem `{ statusCode, error, message, details }`: **400** validação (com `details` por campo), **404** pet/solicitação inexistente, **409** solicitação ativa duplicada para o pet (ou cancelamento inválido), **422** perfil incompleto (com `details` dos campos que faltam).

### Limitação de hospedagem

O json-server é um processo Node separado. `npm run build && npm run preview` também precisa do `npm run mock` rodando. Hospedagens estáticas (Vercel, Netlify, GitHub Pages) **não executam** o json-server: para entregar por link publicado, hospede o mock à parte (ex.: Render ou Railway) e aponte `VITE_API_URL` para ele; caso contrário, a entrega deve ser feita rodando localmente.

### Testes

```bash
npm test
```

Cobre as regras de negócio do `mock-server/server.js` (Vitest + supertest).

Para gerar o build de produção (checagem de tipos + build do Vite):

```bash
npm run build
```

Para rodar apenas a checagem de tipos:

```bash
npm run typecheck
```

## Qualidade de código

| Script                 | O que faz                                                        |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run lint`         | ESLint (typescript-eslint, react-hooks, react-refresh, jsx-a11y) |
| `npm run lint:fix`     | ESLint corrigindo o que for possível automaticamente             |
| `npm run format`       | Prettier reescrevendo os arquivos                                |
| `npm run format:check` | Prettier apenas verificando (usado no CI)                        |
| `npm test`             | Vitest (Testing Library + jsdom), execução única                 |
| `npm run test:watch`   | Vitest em modo watch                                             |

O workflow `.github/workflows/ci.yml` roda em todo PR e em push na `main`:
`npm ci` → `lint` → `format:check` → `typecheck` → `test` → `build`.

## Organização

- `src/components`: componentes reutilizáveis de layout, cards, formulários e etapas
- `src/pages`: páginas do fluxo principal
- `src/data/pets.ts`: massa de dados local para pets, perfil e solicitações
- `src/types.ts`: tipos compartilhados (`Pet`, `Profile`, `AdoptionRequest`, etc.)
- `src/App.tsx`: rotas e estado principal da simulação
