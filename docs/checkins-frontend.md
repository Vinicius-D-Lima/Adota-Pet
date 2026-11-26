# Check-ins pós-adoção no frontend

> Issue [#37](https://github.com/Vinicius-D-Lima/Adota-Pet/issues/37) · depende das APIs de adoção (#23) e check-ins (#24)

A visão do adotante transforma o plano de acompanhamento em uma lista de check-ins com prazo, status, fotos e devolutiva da organização.

## Rotas

| Rota                   | Tela                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `/adocoes`             | Minhas adoções: pets adotados, progresso `enviados / total` e atalho para o detalhe. |
| `/adocoes/:adoptionId` | Detalhe da adoção: plano, check-ins ordenados e formulário de envio.                 |

O link **Minhas adoções** entra no menu principal apenas quando `GET /me/adoptions` devolve ao menos uma adoção para uma conta de adotante.

## Contratos usados

- `GET /me/adoptions` → `adoptionsResponseSchema` (`@adotapet/shared`).
- `POST /api/check-ins/:id/submit` → `multipart/form-data` com `report` e até 5 arquivos no campo `files`; resposta validada por `checkInSchema`.
- `POST /api/check-ins/:id/photos/:photoId/url` → `signedUrlSchema`; a URL recebida é passada por `resolveApiUrl` antes de virar `src` da imagem.

Nenhuma foto é exibida por ID direto: o componente sempre busca a URL assinada da API. O contrato de acesso continua no backend (`CHK-05`), inclusive com expiração curta.

## Envio

`CheckInForm` valida no cliente antes de qualquer requisição:

- relato por `checkInSubmitSchema` (obrigatório, até 5.000 caracteres);
- fotos por `validateCheckInPhotos`: no máximo 5 arquivos, `image/jpeg`, `image/png` ou `image/webp`, até 5 MB cada;
- mensagens específicas por erro, exibidas no campo correspondente.

O seletor usa `accept="image/*"` para abrir a galeria/câmera no celular, mantendo a validação estrita de tipos depois da escolha. Cada arquivo ganha prévia com `URL.createObjectURL` e pode ser removido antes do envio.

Durante o upload, `api.post` usa `XMLHttpRequest` quando recebe `onUploadProgress`, atualizando uma barra com `role="progressbar"` e `aria-valuenow`. Depois da resposta, o check-in passa a `Enviado`, o progresso da adoção é atualizado no cache do TanStack Query e o formulário fecha.

## Leitura

- `ATRASADO` aparece primeiro, com borda e aviso em destaque; `PENDENTE` com data passada também recebe o destaque.
- `ENVIADO` mostra relato e fotos; `REVISADO` mostra o comentário da organização.
- Se a organização pediu mais informações (`PENDENTE` com `reviewerComment`), o check-in recebe um aviso específico no topo do cartão.

## Cobertura

- `packages/shared/src/checkInSchema.test.ts`: contrato e mensagens de validação.
- `apps/web/src/lib/api.test.ts`: resolução de URL assinada e progresso do upload.
- `apps/web/src/components/Layout.test.tsx`: visibilidade do link do menu.
- `apps/web/src/pages/MyAdoptionsPage.test.tsx`: progresso, atrasos, estados vazio e de erro.
- `apps/web/src/pages/AdoptionDetailPage.test.tsx`: ordem dos atrasados, pedido de mais informações, URL assinada, recusa de arquivo inválido e atualização após envio.
- `apps/web/mock-server/server.test.js` e `contract.test.js`: envio, URL assinada, servir a foto e contrato de `/me/adoptions`.
