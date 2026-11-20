# @adotapet/shared

Contrato de dados compartilhado entre `apps/web` e `apps/api`.

Contém os schemas Zod que antes ficavam em `src/schemas/` do frontend (por exemplo `profileSchema` e `questionnaireSchema`) e os tipos derivados deles.

```ts
import { profileSchema, type Profile } from '@adotapet/shared'
```

- Em desenvolvimento (Vite/Vitest), o pacote expõe `src/index.ts`.
- Em Node/build, o pacote expõe `dist/index.js` e `dist/index.d.ts`, gerados por `npm run build -w @adotapet/shared`.

Alterar um campo obrigatório de um schema quebra o `typecheck` de quem não acompanhou (ver `MONO-04` em [`docs/testes/monorepo.md`](../../docs/testes/monorepo.md)).
