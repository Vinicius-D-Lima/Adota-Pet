# Permissões no frontend (#41)

O frontend não decide papéis pelo caminho do perfil (`profilePath`). A fonte de verdade é
`GET /me/permissions`, lida pelo hook `usePermissions()` e usada pelos guards, pelo menu
lateral e pelo componente `<Can>`.

## `usePermissions()`

```ts
import { usePermissions } from '../hooks/usePermissions'

const { data, isPending, isError, refetch } = usePermissions()
```

A resposta é `PermissionsResponse`:

| Campo           | Significado                                                          |
| --------------- | -------------------------------------------------------------------- |
| `role`          | `ADMIN` ou `VOLUNTEER` dentro da organização ativa                   |
| `canApprove`    | Atalho para a permissão de aprovação                                 |
| `permissions`   | Lista `recurso:acao` (por exemplo `requests:approve`)                |
| `organization`  | `{ id, name, initials }` da organização ativa, ou `null`             |
| `organizations` | Todas as organizações das quais a pessoa é membro (opcional)         |
| `rules`         | Regras no estilo CASL: `{ action, subject, conditions? }` (opcional) |

O hook aceita `enabled` e `organizationId`. Quando o seletor troca de organização, o ID é
enviado como `?organizationId=` e entra na query key (`['me', 'permissions', id]`). O
`staleTime` é de 30 s para que uma mudança de papel apareça sem esperar minutos.

Também estão disponíveis `useActivePermissions()` (já usa a organização selecionada),
`useCan(action, subject)`, `useCanApprove()`, `useHasPermission(permission)` e a função pura
`canDo(data, action, subject)`.

## `<Can do="..." on="...">`

API inspirada em `@casl/react`, implementada sobre `usePermissions` (sem dependência nova):

```tsx
import { Can } from '../components/Can'

<Can do="update" on="Organization">
  <form>...</form>
</Can>

<Can do="read" on="Member" fallback={<p>Sem acesso.</p>}>
  <Link to="/organizacao/membros">Membros</Link>
</Can>
```

- `do` é a ação (`read`, `update`, `approve`, `manage`, ...); `on` é o assunto
  (`Member`, `Organization`, `Request`, `Pet`, `Adoption`).
- `manage` e `all`/`*` são curingas; `view` e `read` são aliases.
- Enquanto as permissões carregam, nada aparece — evita "piscar" uma ação proibida.
- `children` também pode ser uma função `(allowed: boolean) => ReactNode`.
- Sem `rules` na resposta, regras locais são inferidas do `role` e de `permissions`.

## Regras usadas na área da organização

| Área                       | Regra exigida              | Rotas                                                            |
| -------------------------- | -------------------------- | ---------------------------------------------------------------- |
| Painel, pets, solicitações | pertencer à organização    | `/organizacao`, `/organizacao/pets`, `/organizacao/solicitacoes` |
| Adoções                    | pertencer à organização    | `/organizacao/adocoes`                                           |
| Membros e convites         | `read` em `Member`         | `/organizacao/membros`, `/organizacao/convites`                  |
| Alterar papel / remover    | `update` em `Member`       | ações na tela de membros                                         |
| Dados da ONG               | `update` em `Organization` | `/organizacao/dados`                                             |

`OrganizacaoGuard` primeiro exige sessão e vínculo com organização; em rotas restritas ele
também avalia a regra e redireciona voluntários ao painel, mesmo quando a URL é digitada
diretamente. Erros de rede mostram "Tentar novamente"; 403/404 de vínculo voltam à home.

## Seletor de organização

`useOrganizations()` lê `GET /me/organizations` e, enquanto esse endpoint não existe no
backend, usa `organizations`/`organization` de `/me/permissions`. O ID ativo fica em
`sessionStorage` (`useSelectedOrganizationId` / `selectOrganization`). Ao trocar,
`useSwitchOrganization()` invalida `['organization']`, `['me', 'permissions']` e
`['me', 'organizations']`, recarregando pets, solicitações, membros e adoções do novo
contexto.

## Endpoints consumidos

```
GET    /me/permissions
GET    /me/organizations
GET    /organizations/:id
PUT    /organizations/:id
GET    /organizations/:id/members
PATCH  /organizations/:id/members/:userId
DELETE /organizations/:id/members/:userId
GET    /organizations/:id/invitations
POST   /organizations/:id/invitations
DELETE /organizations/:id/invitations/:invitationId
GET    /invitations/:token
POST   /invitations/:token/accept
GET    /me/adoptions
```

Erros `409` (por exemplo, "a organização precisa manter ao menos um ADMIN") são exibidos em
`Alert`, e convites expirados/inválidos (400/403/410) viram uma página amigável em
`/convite/:token`.
