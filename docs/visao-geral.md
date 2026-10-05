# Visão geral

## O que é o AdotaPet

Plataforma de **adoção responsável** de animais. A ideia central é que a pessoa não escolhe só pela foto: ela vê quanto o perfil dela combina com as necessidades de cada pet, responde a um questionário e envia uma solicitação à organização responsável, que decide depois.

## Escopo entregue

Esta entrega é **somente o frontend**, em React + TypeScript, conversando com uma **API REST simulada** (json-server). O fluxo principal está completo:

1. Página inicial e apresentação do produto
2. Busca e filtros de pets (espécie, porte, sexo, ordenação, texto livre)
3. Detalhes e necessidades do animal
4. Compatibilidade entre o perfil do adotante e o pet
5. Questionário de adoção com validação
6. Envio e confirmação da solicitação
7. Acompanhamento e cancelamento das solicitações
8. Favoritos
9. Edição do perfil usado na compatibilidade

Além do fluxo, o frontend tem:

- estados de carregamento, erro e vazio em todas as telas que leem a API;
- página 404 e Error Boundary (nenhum erro de renderização deixa a tela em branco);
- carregamento sob demanda das páginas (code splitting);
- bloqueio de solicitação duplicada **antes** de a pessoa preencher o questionário;
- confirmação antes de cancelar uma solicitação;
- selos de vacinação e castração, critério de tempo disponível na compatibilidade e atalho "Usar minhas preferências";
- biblioteca de componentes reutilizáveis;
- lint, formatação, testes automatizados e CI.

## O que ficou fora (por decisão)

- **Backend real**, banco de dados, autenticação (JWT) e permissões. Existe um usuário de demonstração fixo.
- Área da organização (cadastro de pets, gestão de membros).
- Chat, etapas da solicitação, acompanhamento pós-adoção, notificações, avaliações e denúncias.
- Migração para Next.js (a issue #7 foi encerrada como "não planejada").
- **Acessibilidade completa** (menu por teclado, foco visível, teste com axe): foi implementada no PR #81, mas o PR foi **revertido** no #82. Veja [Histórico](historico.md#o-revert-da-acessibilidade-81-e-82).

A lista completa do que falta está em [Roadmap e pendências](roadmap.md).

## Como executar

Requisitos: Node.js 22 (o CI usa a versão 22) e npm.

```bash
npm install
npm run dev:mock
```

Um único comando sobe o frontend (Vite) e a API simulada.

- Frontend: <http://localhost:5173>
- API simulada: <http://localhost:3001> (o Vite faz proxy de `/api` para ela, então não há CORS)

| Comando              | O que faz                                                   |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev:mock`   | Frontend + API simulada juntos (uso normal)                 |
| `npm run dev`        | Só o frontend (Vite)                                        |
| `npm run mock`       | Só a API simulada                                           |
| `npm run mock:reset` | Restaura os dados do mock ao estado original                |
| `npm run build`      | Checagem de tipos + build de produção                       |
| `npm run preview`    | Serve o build (a API simulada precisa estar rodando também) |

### Variáveis de ambiente

| Variável        | Padrão | Onde         | Descrição                                                        |
| --------------- | ------ | ------------ | ---------------------------------------------------------------- |
| `VITE_API_URL`  | `/api` | Frontend     | URL base da API. Para usar outra API, basta trocar esta variável |
| `MOCK_PORT`     | `3001` | API simulada | Porta do json-server                                             |
| `MOCK_DELAY_MS` | `300`  | API simulada | Latência simulada em milissegundos                               |

O arquivo `.env.example` traz o valor de `VITE_API_URL` para o modo mock.

### Publicar o frontend

O json-server é um processo Node separado. Hospedagens estáticas (Vercel, Netlify, GitHub Pages) **não o executam**. Para entregar por um link publicado, hospede a API simulada à parte (por exemplo no Render ou no Railway) e aponte `VITE_API_URL` para ela. Caso contrário, a entrega deve ser feita rodando localmente. O CI **não faz deploy**: ele só valida.

## Quem fez o quê

O projeto foi construído em PRs pequenos sobre a branch `dev`, por duas pessoas (Vinicius e Igor), com apoio do Claude Code. O histórico completo, com autoria e datas, está em [Histórico](historico.md).
