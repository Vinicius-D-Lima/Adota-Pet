# Integração do módulo de armazenamento (#94)

> **Estado:** o módulo de storage está pronto. Os módulos `#24` (check-ins), `#26` (denúncias), `#29` (prontuário) e `#49` (fotos de pets) **ainda não consomem o storage** — hoje só a exclusão de pet (`DELETE /api/me/organization-pets/:id`) chama a limpeza de órfãos. Se você for implementar um desses módulos, **este é o checklist obrigatório**.

## O que já existe

| Peça                                | Onde                                                               |
| ----------------------------------- | ------------------------------------------------------------------ |
| Interface + implementação S3        | `apps/api/src/storage.ts` (`StorageProvider`, `S3StorageProvider`) |
| Escopos por recurso                 | `STORAGE_SCOPES` em `apps/api/src/storage.ts`                      |
| Validação de assinatura/tamanho/qtd | `validateUploadFiles()` em `apps/api/src/storage.ts`               |
| Chaves geradas no servidor          | `buildObjectKey()` em `apps/api/src/storage.ts`                    |
| URLs assinadas da API               | `signObjectUrl()` / `verifyObjectToken()`                          |
| Rotas de upload/URL/exclusão        | `apps/api/src/routes/storage.ts`                                   |
| Entrega com `nosniff`               | `GET /files/:id` em `apps/api/src/routes/storage.ts`               |
| Limpeza de órfãos                   | `deleteStorageObjectsForResource()`                                |
| Metadados e vínculo                 | model `StorageObject` (migration `20261122130000_storage`)         |
| Schemas do contrato                 | `packages/shared/src/storageSchema.ts`                             |
| Testes `[STO-01]` a `[STO-09]`      | `apps/api/src/storage.test.ts`                                     |

## Regra de ouro

**Nenhum módulo fala com o S3 diretamente.** Todo arquivo entra por `POST /api/storage/objects`, é lido pela URL devolvida no upload (ou por `POST /api/storage/objects/:id/url`) e é apagado junto com o registro dono. O bucket é privado: nunca gere uma URL pública nem devolva a chave do objeto como se fosse um link.

## Como integrar cada módulo

### 1. Fotos de pets (#49)

1. No cadastro/edição de pet da instituição (`src/routes/organization.ts`), aceite `multipart/form-data` em vez de exigir uma URL externa em `image`.
2. Escolha o escopo `petPhoto` (prefixo `pets`, JPEG/PNG/WebP, até 8 arquivos de 5 MB).
3. Envie `scope=petPhoto`, `resourceType=PET`, `resourceId=<pet.id>` e o campo `files`.
4. Grave os `id`s retornados (ou as URLs assinadas) no pet; mantenha `image`/`gallery` como projeção das URLs devolvidas.
5. A exclusão **já está ligada**: `deleteStorageObjectsForResource('PET', id)` roda antes de `prisma.pet.delete`. Não duplique essa chamada.

### 2. Check-ins pós-adoção (#24)

1. Crie o modelo `CheckIn` com o vínculo ao pedido de adoção aprovado.
2. Use o escopo `checkInPhoto` (`check-ins`, até 5 fotos de 5 MB) no envio do check-in.
3. Passe `resourceType=CHECKIN` e `resourceId=<checkIn.id>`.
4. Ao apagar/cancelar o check-in, chame `deleteStorageObjectsForResource('CHECKIN', id)` na mesma transação lógica (remover objetos antes das linhas).
5. Os jobs `check-in-overdue` / `daily-digest` já existem em `src/jobs.ts`; registre o handler de domínio com `registerJobHandler()`.

### 3. Denúncias (#26)

1. Crie o modelo `Report` (alvo, categoria, descrição, status de moderação).
2. Use o escopo `reportAttachment` (`reports`, até 5 imagens de 5 MB).
3. Passe `resourceType=REPORT` e `resourceId=<report.id>`.
4. Restrinja a leitura das URLs a `MODERADOR` **e** ao autor: `POST /api/storage/objects/:id/url` já exige `ownerId === req.auth.userId`; se o moderador precisar ver anexos alheios, adicione uma política explícita naquele ponto (nunca abra o `GET /files/:id` sem assinatura).
5. Ao resolver/excluir a denúncia com remoção de anexos, chame `deleteStorageObjectsForResource('REPORT', id)`.

### 4. Prontuário médico (#29)

1. Crie o modelo de exame/prontuário com `petId`, tipo, data e observações (auditoria em `PRO-07`).
2. Use o escopo `medicalExam` (`medical-exams`, imagens + PDF, até 5 arquivos de 10 MB).
3. Passe `resourceType=MEDICAL_EXAM` e `resourceId=<exam.id>`.
4. A view pública do pet (`GET /api/pets/:id`) **não** deve devolver URLs de exames — só a view autenticada da instituição.
5. Ao excluir o exame, chame `deleteStorageObjectsForResource('MEDICAL_EXAM', id)`.

## Checklist antes de dizer que a integração está pronta

- [ ] O módulo chama `POST /api/storage/objects` (ou um service que o faça) — não usa `PutObjectCommand` próprio.
- [ ] Usa um `STORAGE_SCOPES` existente ou define um novo **em `storage.ts`**, com prefixo, MIMEs, contagem e tamanho.
- [ ] Passa `resourceType`/`resourceId` válidos (ver `storageResourceTypes` em `@adotapet/shared`).
- [ ] Salva o `id`/`key` retornado; não confia no nome enviado pelo usuário.
- [ ] Exibe arquivos só pela URL assinada devolvida pela API.
- [ ] Apaga os objetos quando o registro dono é apagado.
- [ ] Cobriu o cenário com teste cujo nome começa com o ID do módulo (`[PET-10]`, `[CHK-..]`, `[DEN-08]`, `[PRO-06]`).

## O que não fazer

- Não versionar credenciais nem URL de bucket no repositório.
- Não usar `STORAGE_ENDPOINT` como sinônimo de "bucket público".
- Não confiar em `Content-Type` enviado pelo navegador: a API detecta a assinatura do arquivo.
- Não montar chaves com `resourceId` do cliente ou com `../` — `buildObjectKey()` usa UUID.
- Não expor `GET /files/:id` fora da rota assinada (ela é a única forma de leitura).

## Trocar de provedor

Não há código específico de SeaweedFS. Aponte `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_FORCE_PATH_STYLE` e as credenciais para R2, S3 ou outro compatível. Com `STORAGE_ENDPOINT` vazio, o SDK usa o endpoint padrão da AWS e a cadeia de credenciais. Veja o README da raiz, seção **Armazenamento de arquivos**.
