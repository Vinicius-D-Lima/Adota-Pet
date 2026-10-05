# Componentes

Há dois grupos: a **biblioteca de UI** (`src/components/ui`), genérica e sem regra de negócio, e os **componentes da aplicação** (`src/components`), que conhecem o domínio de adoção.

## Biblioteca de UI (`src/components/ui`)

Importe sempre do índice:

```tsx
import { Button, LinkButton, Field, Input, Alert } from '../components/ui'
```

Os estilos ficam em `src/components/ui/ui.css`. Convenção de props, igual em todos os componentes: `variant`, `size`, `disabled`, `loading`, `invalid` / `error` e `fullWidth`.

| Componente                                | Uso                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                                  | `variant`: `primary` (padrão), `secondary`, `cream`, `danger`, `text`, `text-danger`. `size`: `md` ou `sm`. `fullWidth`. `loading` desabilita, mostra um spinner e marca `aria-busy` |
| `LinkButton`                              | Link do React Router com a aparência de `Button` (mesmas props visuais)                                                                                                              |
| `Field` + `Input` / `Select` / `Textarea` | `Field` é o rótulo e traz `hint` e `error` (o erro substitui a dica). Os controles aceitam `invalid`, que define `aria-invalid`                                                      |
| `Checkbox`                                | `label`, `description` e `error`                                                                                                                                                     |
| `Card`                                    | Superfície base (fundo branco, borda e raio). `as` troca a tag (`div`, `article`, `section`, `aside`) e `className` define o layout                                                  |
| `Badge`                                   | Etiqueta colorida por `tone`: `review`, `approved`, `sent` ou `declined`                                                                                                             |
| `StatusPill`                              | Mapeia o status da solicitação para um `Badge` com ícone                                                                                                                             |
| `Alert`                                   | Erro de formulário ou de ação, com `role="alert"`                                                                                                                                    |
| `EmptyState`                              | Estado vazio ou de erro: `icon`, `title`, `headingAs` (`h1` ou `h2`), `description`, `role="alert"` e filhos (a ação)                                                                |
| `Spinner`                                 | Indicador de carregamento com `role="status"` e `label`                                                                                                                              |
| `PageIntro`                               | Cabeçalho de página: `eyebrow`, `title` (o `h1`) e `description`                                                                                                                     |

### Exemplos

```tsx
<Field label="Nome" error={errors.name}>
  <Input value={name} onChange={onChange} invalid={Boolean(errors.name)} />
</Field>

<Button type="submit" loading={isPending}>Salvar</Button>
<LinkButton variant="secondary" to="/pets">Ver pets</LinkButton>

<EmptyState headingAs="h1" title="Pet não encontrado" role="alert">
  <LinkButton to="/pets">Ver outros pets</LinkButton>
</EmptyState>
```

### Notas

- O que antes se chamava variante `ghost` agora é **`secondary`**.
- O ESLint reconhece `Input`, `Select` e `Textarea` como controles de formulário (`jsx-a11y/label-has-associated-control`), então o `Field` envolvendo um deles conta como rótulo associado.
- **Botões próprios (fora da biblioteca):** o coração de favoritar, o botão do menu e os botões de alternância do filtro de porte têm estilo específico e continuam como `<button>` comuns.
- Os testes da biblioteca estão em `src/components/ui/ui.test.tsx`.

## Componentes da aplicação (`src/components`)

| Componente            | O que faz                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Layout`              | Cabeçalho, menu com contadores (favoritos e solicitações ativas), atalho do usuário, rodapé e a região do aviso de favoritos                        |
| `PetCard`             | Cartão do pet: foto, distância, favoritar, dados, selos de saúde e link para o detalhe. `PetCardSkeleton` é o esqueleto de carregamento             |
| `HealthBadges`        | Selos de vacinação e castração, sempre nos dois estados ("Vacinado" ou "Não vacinado", "Castrado" ou "Não castrado")                                |
| `FlowSteps`           | As quatro etapas do fluxo de adoção, com a atual destacada                                                                                          |
| `ActiveRequestNotice` | Aviso "Você já tem uma solicitação em andamento para {pet} ({código} · {status})", com link para as solicitações                                    |
| `ConfirmDialog`       | Modal de confirmação acessível (ver abaixo)                                                                                                         |
| `ErrorBoundary`       | Captura erros de renderização e mostra "Algo deu errado", com "Tentar novamente" e "Voltar ao início"; aceita `resetKeys` para se limpar ao navegar |
| `NotFoundState`       | Tela de "não encontrado" com título, mensagem e link de volta. Usada na página 404 e para pet e solicitação inexistentes                            |
| `FavoriteNotice`      | Aviso temporário (5 s) quando favoritar ou desfavoritar falha; é uma região `role="status"`                                                         |

### `ConfirmDialog`

Modal de confirmação com `title`, `description`, `confirmLabel` e `cancelLabel` (padrão "Voltar").

- Renderiza em um portal no `<body>`, com `role="dialog"`, `aria-modal`, `aria-labelledby` e `aria-describedby`.
- O foco inicial vai para o primeiro botão ("Voltar"), a opção segura, e não para a destrutiva.
- **Foco preso** com Tab e Shift+Tab. Ao fechar, o foco volta ao elemento que abriu o modal (ou ao que `returnFocus` indicar).
- **Esc**, clique fora e "Voltar" chamam `onClose`.
- Com `busy`, os botões ficam desabilitados e Esc e clique fora são ignorados (há uma requisição em andamento).
- Enquanto está aberto, o resto da página fica `inert` e a rolagem do fundo é travada, e tudo é restaurado ao fechar.
- Sem `Toast` genérico por enquanto: nenhuma tela além dos favoritos precisou de um.
