# Manual de operação

Para quem mantém o AdotaPet rodando: subir e derrubar, manter os dados do mock, acompanhar o CI e atender problemas. O produto é um protótipo de frontend, então "operar" aqui significa cuidar da API simulada, do build e do fluxo de trabalho da equipe.

## 1. Rotina de execução

| Tarefa                        | Comando              | Observação                                     |
| ----------------------------- | -------------------- | ---------------------------------------------- |
| Subir frontend + API simulada | `npm run dev:mock`   | Uso diário                                     |
| Subir só o frontend           | `npm run dev`        | Precisa de uma API acessível em `VITE_API_URL` |
| Subir só a API simulada       | `npm run mock`       | Porta `MOCK_PORT` (3001)                       |
| Restaurar os dados            | `npm run mock:reset` | Copia `db.seed.json` sobre `db.json`           |
| Gerar o build                 | `npm run build`      | Saída em `dist/`                               |
| Servir o build localmente     | `npm run preview`    | Porta 4173, com a API simulada rodando         |

Para encerrar, use `Ctrl+C` no terminal. Não há processo em segundo plano.

## 2. Dados da API simulada

- **Seed versionado:** `mock-server/db.seed.json`. É a "fotografia" original: 1 usuário de demonstração, 12 pets, 1 perfil completo, 1 favorito (Luna) e 4 solicitações de exemplo, uma de cada status.
- **Banco em uso:** `mock-server/db.json`, criado na primeira execução e **ignorado pelo git**. Guarda tudo o que a pessoa faz (favoritos, perfil, solicitações).
- **Voltar ao estado original:** `npm run mock:reset`. Faça isso antes de uma demonstração, depois de testes manuais e sempre que atualizar o projeto.

### Solicitações do seed

| Código     | Pet    | Status       | Para que serve                                             |
| ---------- | ------ | ------------ | ---------------------------------------------------------- |
| `SOL-1039` | Fred   | `Aprovada`   | Mostra o status; conta como ativa e não pode ser cancelada |
| `SOL-1040` | Nina   | `Recusada`   | Mostra o status final e libera nova solicitação do pet     |
| `SOL-1041` | Tobias | `Cancelada`  | Mostra uma solicitação cancelada                           |
| `SOL-1042` | Mimi   | `Em análise` | Única que pode ser cancelada na demonstração inicial       |

A próxima solicitação criada recebe `SOL-1043`. Como o mock não tem rota para aprovar ou recusar, esses dois status só existem por causa do seed.

## 3. Configuração

| Variável        | Padrão | Efeito                                                                              |
| --------------- | ------ | ----------------------------------------------------------------------------------- |
| `VITE_API_URL`  | `/api` | URL base que o frontend usa (definida em tempo de build)                            |
| `MOCK_PORT`     | `3001` | Porta do json-server                                                                |
| `MOCK_DELAY_MS` | `300`  | Latência simulada. Use `0` para testes e `1500` para ver os estados de carregamento |

Exemplo: `MOCK_DELAY_MS=1500 MOCK_PORT=3002 npm run mock`.

## 4. Verificação de saúde

1. `GET http://localhost:3001/pets?limit=1` deve responder 200 com `total`.
2. `GET http://localhost:3001/me/adopter-profile` deve trazer `"isComplete": true` com o seed novo.
3. Na interface, o menu deve mostrar o contador de favoritos (1) e de solicitações ativas (2: a `Aprovada` e a `Em análise`) logo depois do reset.

## 5. Rotina de qualidade (antes de abrir ou atualizar um PR)

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Todos os passos precisam sair sem erro. O CI executa exatamente esta sequência no Node 22. Detalhes em [Qualidade, testes e CI](qualidade-e-ci.md).

## 6. Fluxo de branches e PRs

1. Crie a branch a partir da `dev` (`feat/…`, `fix/…`, `docs/…`, `refact/…`).
2. Faça commits pequenos (`feat:`, `fix:`, `docs:`).
3. Rode a bateria da seção 5.
4. Abra o PR **para a `dev`**. A `main` só recebe da `dev`.
5. Se houver conflito, traga a `dev` para a branch (`git merge origin/dev`). **Sem rebase e sem force-push.**
6. Espere o CI ficar verde e peça revisão. Quem escreve o PR não faz o merge sozinho.
7. As issues só fecham sozinhas ao chegar na branch padrão; como os PRs vão para a `dev`, feche-as manualmente quando o PR for mesclado.

## 7. Resolução de problemas

| Sintoma                                            | Diagnóstico                                               | Ação                                                                       |
| -------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Listas em "Carregando…" ou erro "Tentar novamente" | API fora do ar ou porta errada                            | Confira `npm run mock`, a porta e o proxy do Vite                          |
| 422 ao enviar solicitação                          | Perfil incompleto                                         | Complete em `/perfil` (ou `npm run mock:reset`)                            |
| 409 ao solicitar                                   | Já há solicitação ativa para o pet                        | Cancele a anterior em `/solicitacoes`                                      |
| 409 ao cancelar                                    | Status mudou ou é `Aprovada`/`Recusada`/`Cancelada`       | Atualize a lista; só `Enviada` e `Em análise` cancelam                     |
| 400 em `/pets`                                     | Parâmetro desconhecido na URL                             | Use só `search`, `species`, `size`, `sex`, `city`, `sort`, `page`, `limit` |
| CI vermelho só na mescla                           | O CI roda sobre o resultado da mescla com a `dev`         | Traga a `dev` para a branch, rode a bateria e envie                        |
| Teste que "passa sozinho e falha em conjunto"      | TanStack Query notifica em `setTimeout(0)`                | Espere esse tick dentro de `act` (ver Qualidade e CI)                      |
| Estilos quebrados depois de atualizar              | Dependências antigas (Tailwind 4 usa `@tailwindcss/vite`) | `npm ci` e reinicie o Vite                                                 |

## 8. Limitações operacionais

- Um único usuário de demonstração e nenhuma autenticação.
- O banco é um arquivo JSON: sem concorrência real e sem backup. Para um ambiente compartilhado, use um `db.json` por pessoa.
- Sem monitoramento, logs centralizados ou deploy automático. O CI só valida.
- As fotos dos pets são URLs externas (Unsplash); sem internet elas não carregam.
