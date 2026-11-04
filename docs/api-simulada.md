# API simulada (json-server)

O frontend conversa com uma API REST simulada, em `mock-server/`. Ela existe para que o frontend possa ser **entregue e demonstrado sem backend**, com um contrato que um backend real poderá implementar depois (as issues de backend #47 a #51 descrevem esse contrato).

- Baseada em [json-server](https://github.com/typicode/json-server) **0.17.4** (Express), com rotas, validação e regras de negócio próprias em `mock-server/server.js`.
- As rotas respondem tanto em `/pets` quanto em `/api/pets`. O Vite faz proxy de `/api` para `http://localhost:3001`, então o navegador nunca vê CORS.
- Não existe login real. As rotas `/me/*` usam o usuário indicado por `X-Demo-User-Id` (entre as contas de demonstração do seed) ou `demo` quando o cabeçalho não é enviado.

## Dados

| Arquivo                    | Papel                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `mock-server/db.seed.json` | Seed **versionado**: contas de demonstração, 12 pets, perfis, favoritos, solicitações e notificações de exemplo |
| `mock-server/db.json`      | Banco em uso. Criado a partir do seed na primeira execução e **ignorado pelo git**                              |

Os dados (favoritos, perfil, solicitações e buscas salvas) **persistem entre recarregamentos e reinícios**, porque ficam no `db.json`.

```bash
npm run mock:reset   # copia o seed sobre o db.json e volta aos dados originais
```

> **Já tinha um `db.json` de uma versão anterior?** Rode `npm run mock:reset`. Sem isso o servidor sobe, mas o perfil aparece com `isComplete: false` (os campos novos `cpf`, `birthDate`, `email`, `phone`, `zipCode` e `address` ficam em `missingFields`), e `POST /requests` responde 422 até o perfil ser preenchido.

Pets do seed: Luna, Bento, Mimi, Fred, Nina, Tobias, Thor, Amora, Simba, Pipoca, Rex e Maya (8 cachorros e 4 gatos, de portes Pequeno, Médio e Grande).

Solicitações do seed: `SOL-1039` (Fred, `Aprovada`), `SOL-1040` (Nina, `Recusada`), `SOL-1041` (Tobias, `Cancelada`) e `SOL-1042` (Mimi, `Em análise`). A conta `demo` também tem notificações de exemplo para testar o sino, o histórico e o contador de não lidas.

## Configuração

| Variável        | Padrão | Efeito                                  |
| --------------- | ------ | --------------------------------------- |
| `MOCK_PORT`     | `3001` | Porta do servidor                       |
| `MOCK_DELAY_MS` | `300`  | Latência simulada em cada resposta (ms) |

## Rotas

| Rota                                                       | O que faz                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `GET /pets`                                                | Lista pets com filtros, ordenação e paginação               |
| `GET /pets/:id`                                            | Um pet (404 se não existir)                                 |
| `GET /me`                                                  | Usuário de demonstração                                     |
| `GET /me/adopter-profile`                                  | Perfil com `isComplete` e `missingFields`                   |
| `PUT /me/adopter-profile`                                  | Atualização parcial do perfil                               |
| `POST /requests`                                           | Cria uma solicitação de adoção                              |
| `GET /me/requests`                                         | Solicitações do usuário (a mais recente primeiro)           |
| `GET /requests/:id`                                        | Uma solicitação do usuário                                  |
| `POST /requests/:id/transitions`                           | Muda o status (hoje só `{ "to": "CANCELADA" }`)             |
| `GET /requests/:id/messages?cursor=`                       | Mensagens da solicitação com paginação por cursor           |
| `POST /requests/:id/messages`                              | Envia uma mensagem de texto puro (máximo 2.000 caracteres)  |
| `PATCH /requests/:id/messages/read`                        | Marca mensagens recebidas da conversa como lidas (204)      |
| `GET /me/favorites` · `GET /me/favorites/ids`              | Favoritos (pets completos / só os IDs)                      |
| `PUT /me/favorites/:petId` · `DELETE /me/favorites/:petId` | Adiciona / remove favorito (204, idempotentes)              |
| `GET /me/saved-filters`                                    | Lista as buscas salvas da conta atual                       |
| `POST /me/saved-filters`                                   | Cria uma busca (máximo de 10 por conta; 409 no limite)      |
| `PATCH /me/saved-filters/:id`                              | Atualiza nome ou estado do alerta                           |
| `DELETE /me/saved-filters/:id`                             | Exclui uma busca da conta atual (204)                       |
| `GET /me/notifications?cursor=&unread=`                    | Notificações paginadas e contador global de não lidas       |
| `PATCH /me/notifications/:id/read`                         | Marca como lida uma notificação da conta atual (204)        |
| `PATCH /me/notifications/read-all`                         | Marca como lidas todas as notificações da conta atual (204) |
| `GET /me/notification-preferences`                         | Preferências de canal por tipo de notificação               |
| `PUT /me/notification-preferences`                         | Substitui as preferências com `{ "data": [...] }`           |

### Buscas salvas

As buscas são isoladas por `X-Demo-User-Id` e persistem em `db.json`. A resposta de listagem tem o formato `{ data: SavedFilter[], total }`; cada item contém `id`, `name`, `criteria`, `active` e `createdAt`. Os critérios aceitos são `search`, `species` (`Cachorro` ou `Gato`), `size` (lista de portes), `sex` e `city`. Critérios desconhecidos ou valores inválidos retornam 400, e o 11º filtro da conta retorna 409.

O mock salva e atualiza o estado do alerta, mas não avalia novos pets, não cria notificações `NewMatchingPet` e não envia o resumo diário por e-mail. O processamento de eventos e o resumo dependem do backend real descrito na issue #31 e da infraestrutura da #95.

### Notificações

As notificações e preferências são separadas por `X-Demo-User-Id` e persistem em `db.json`. A listagem retorna `{ data, unreadCount, nextCursor }`; o cursor aponta para o último item da página anterior e `unread=true` filtra os itens sem `readAt`. A identidade interna do usuário não é incluída nas respostas.

As preferências retornam `{ data: [{ type, inApp, email }] }`. O `PUT` recebe a lista completa em `data`, com exatamente uma entrada para cada tipo. Os valores padrão deixam o canal in-app ativo e habilitam e-mail apenas para os tipos marcados como críticos no mock.

Este servidor apenas simula a API: não processa eventos de domínio, não envia e-mails e não implementa autenticação/autorização real. Os endpoints do backend continuam descritos na issue #30.

### Chat da solicitação

As rotas do chat local simulam o contrato da issue #22. O histórico retorna `{ data, unreadCount, nextCursor }`, com mensagens em ordem cronológica e páginas de até 20 itens. `cursor` aponta para a mensagem mais antiga carregada, para buscar mensagens anteriores. Mensagens são renderizadas como texto e respostas não incluem IDs de autor, e-mail ou telefone. O mock permite leitura aos participantes da solicitação e bloqueia envio quando o status é `Aprovada`, `Recusada` ou `Cancelada`.

O mock não implementa autenticação/autorização real, limites de taxa ou emissão do evento `MessageReceived`; essas garantias continuam sendo responsabilidade do backend.

### `GET /pets`

Parâmetros aceitos: `search`, `species`, `size`, `sex`, `city`, `sort`, `page` e `limit`.

- **Resposta:** `{ data: Pet[], total: number }`, onde `total` é o número de pets que casam com o filtro (não o da página).
- **`sort`:** `recent` (padrão, por data de criação decrescente), `name` (A–Z) ou `distance` (mais próximos).
- **`search`:** busca livre em todos os campos de texto do pet.
- **Parâmetro repetido** significa "um dos valores": `?size=Pequeno&size=Médio` devolve pets pequenos **ou** médios. Funciona também com `sort=distance`.
- **Paginação:** `page` começa em 1. `limit` padrão **12**, máximo **100**.
- **Distância:** cada pet vem com `distanceKm` (número, uma casa decimal) e `distance` (texto, ex.: `"2,6 km"`), calculados pela fórmula de Haversine entre as coordenadas do pet e as do usuário de demonstração. As coordenadas (`lat`, `lng`) não são devolvidas.
- **Parâmetros desconhecidos retornam 400**, em vez de uma lista vazia que esconderia o erro:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Parâmetros de consulta inválidos",
  "details": [{ "field": "lat", "message": "Parâmetro desconhecido" }]
}
```

`page` e `limit` precisam ser inteiros positivos, e `sort` precisa ser um dos três valores; do contrário também é 400.

### Perfil do adotante

`GET /me/adopter-profile` devolve os campos do perfil mais:

- `isComplete`: `true` só quando **todos** os campos obrigatórios estão válidos;
- `missingFields`: lista dos que faltam ou estão inválidos (por exemplo `["cpf", "address"]`).

`PUT /me/adopter-profile` aceita atualização **parcial**. Campos e regras (as mesmas do `profileSchema` do frontend):

| Campo                                                                 | Regra                                                                 |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `name`                                                                | Pelo menos 3 caracteres                                               |
| `cpf`                                                                 | CPF válido (dígitos verificadores); aceita máscara                    |
| `birthDate`                                                           | `YYYY-MM-DD`, data real e **18 anos ou mais**                         |
| `email`                                                               | E-mail válido                                                         |
| `phone`                                                               | 10 ou 11 dígitos (com DDD); aceita máscara                            |
| `zipCode`                                                             | 8 dígitos; aceita máscara                                             |
| `address`                                                             | Pelo menos 5 caracteres                                               |
| `housing`                                                             | `Apartamento`, `Casa` ou `Chácara ou sítio`                           |
| `dailyTime`                                                           | `Até 1 hora`, `2 a 3 horas` ou `Mais de 3 horas`                      |
| `activityLevel`                                                       | `Tranquilo`, `Moderado` ou `Ativo`                                    |
| `experience`                                                          | `Primeiro pet`, `Já tive pets` ou `Tenho bastante experiência`        |
| `preferredSpecies`                                                    | `Sem preferência`, `Cachorro` ou `Gato`                               |
| `preferredSize`                                                       | `Sem preferência`, `Pequeno`, `Pequeno ou médio` ou `Médio ou grande` |
| `hasOutdoorArea`, `hasChildren`, `hasOtherPets`, `acceptsSpecialCare` | Booleanos                                                             |

- `cpf`, `phone` e `zipCode` são guardados **só com dígitos**.
- Texto vazio (`""`) **limpa** o campo (o formulário usa `''` para "não preenchido"), e o campo volta para `missingFields`.
- Valores inválidos retornam **400** com `details` por campo; nada é gravado nesse caso.

### Solicitações

`POST /requests` recebe `{ petId, answers }`, onde `answers` traz `motivation`, `routine`, `aloneTime`, `adaptation`, `costs` e `commitment` (regras em [Funcionalidades](funcionalidades.md#questionário-petspetidquestionario)). Ordem das verificações:

1. **400:** corpo inválido, com `details` por campo (`answers.motivation`, `answers.costs`...).
2. **404:** pet inexistente.
3. **422:** perfil incompleto, com `details` listando os campos de `missingFields`.
4. **409:** já existe solicitação **ativa** (`Enviada`, `Em análise` ou `Aprovada`) para o pet.
5. **201:** criada. O servidor gera o `id` (`SOL-` mais o maior número existente + 1, a partir de `SOL-1043` com o seed atual), a `date` (ISO), o status `Enviada` e a mensagem.

Toda solicitação devolvida traz o **pet embutido** (`pet`, ou `null` se o pet não existir mais) e a data em ISO.

`POST /requests/:id/transitions` com `{ "to": "CANCELADA" }`:

- **200** se o status é `Enviada` ou `Em análise`;
- **409** se o status não permite cancelar (por exemplo, já cancelada);
- **404** se a solicitação não existe;
- **400** se o destino for outro (hoje só `CANCELADA` é aceito).

### Favoritos

- `PUT /me/favorites/:petId` é **idempotente** (favoritar duas vezes não duplica) e devolve **404** se o pet não existe.
- `DELETE /me/favorites/:petId` também é idempotente e sempre devolve 204.

### Rotas da instituição

Exclusivas de contas com o papel `GUARDIAN` (instituição ou protetor). Qualquer outra conta recebe **403** ("Esta área é exclusiva para instituições e protetores").

| Rota                                                    | O que faz                                               |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `PUT /me/account`                                       | Grava os dados da conta criada em `/criar-conta`        |
| `GET /me/guardian-profile` · `PUT /me/guardian-profile` | Perfil da instituição ou do protetor                    |
| `GET /me/organization-pets`                             | Pets da instituição                                     |
| `POST /me/organization-pets`                            | Cadastra um pet (201); o `id` é gerado a partir do nome |
| `PUT /me/organization-pets/:id`                         | Edita um pet da própria instituição                     |
| `DELETE /me/organization-pets/:id`                      | Remove um pet da própria instituição                    |
| `GET /me/received-requests`                             | Solicitações dos pets da instituição                    |
| `POST /me/received-requests/:id/transitions`            | `{ "to": "EM_ANALISE" \| "APROVADA" \| "RECUSADA" }`    |

As transições da instituição aceitas são `Enviada` → `Em análise` ou `Recusada`, e `Em análise` → `Aprovada` ou `Recusada`. Destino desconhecido retorna **400**, transição fora dessa tabela retorna **409**, e solicitação de pet de outra instituição retorna **404**.

## Formato de erro

```json
{ "statusCode": 409, "error": "Conflict", "message": "…", "details": [] }
```

| Código  | Quando                                                                     |
| ------- | -------------------------------------------------------------------------- |
| **400** | Validação (com `details` por campo), parâmetro desconhecido, JSON inválido |
| **404** | Pet, solicitação ou recurso inexistente                                    |
| **409** | Solicitação ativa duplicada para o pet; cancelamento inválido              |
| **422** | Perfil incompleto ao enviar uma solicitação                                |
| **500** | Erro interno do servidor                                                   |

`details` é opcional e, quando existe, é uma lista de `{ field, message }`.

## Testes

- `mock-server/server.test.js` (Vitest + supertest, banco em memória): cobre pets, perfil, solicitações, transições e favoritos, incluindo cada código de erro.
- `mock-server/contract.test.js`: valida as respostas **reais** do servidor (`GET /me/requests`, `GET /requests/:id`, `POST /requests` e cancelamento) contra os schemas Zod do frontend. Foi criado depois de um bug em que a lista de solicitações ficava em "Carregando…" no navegador por uma diferença de contrato que os testes unitários não pegavam.

Os dois rodam no ambiente `node` (`// @vitest-environment node`), enquanto os testes do frontend rodam em `jsdom`.

## Limitações conhecidas

- Um único usuário, sem autenticação nem permissões.
- O adotante só cria e cancela. `Aprovada` e `Recusada` são decididas pela instituição, pelas rotas da seção anterior, mas sem etapas intermediárias (entrevista, visita), sem motivo obrigatório e sem distinção entre administrador e voluntário. As quatro solicitações do seed mostram cada status desde o primeiro uso.
- Sem upload de fotos: os pets usam URLs externas.
- Sem concorrência real: é um arquivo JSON e um processo.
- A compatibilidade é calculada **no frontend**; o mock não tem rota de recomendação.
