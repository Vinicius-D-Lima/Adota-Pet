# Prontuário médico no frontend (#42)

## Contrato

`GET /pets/:petId/medical-record` devolve dois formatos, validados em
`packages/shared/src/medicalRecordSchema.ts`:

- **público**: `vaccinated`, `neutered`, `specialCare` derivados, vacinas, castração e
  condições sem `notes`, nem exames e nem auditoria;
- **completo** (`complete: true`): membro da organização do pet ou adotante com
  solicitação ativa. Acrescenta `notes` das condições, exames com anexo assinado e
  `createdAt/createdById/updatedAt/updatedById` de cada item.

`vaccinationInputSchema` também valida a regra cruzada: `nextDoseAt` não pode ser
anterior a `appliedAt` (mensagem: “A próxima dose não pode ser anterior à data de
aplicação.”).

## Hooks

- `useMedicalRecord(petId)` — `useQuery` com `medicalRecordKeys.detail(petId)`.
- `useMedicalRecordPermission(petId)` — usa `/me/organization-pets` para saber se o
  usuário é membro da organização. Um 403 na leitura também esconde a edição.
- `useMedicalRecordMutations()` — POST/PUT/DELETE de vacinas, condições e exames,
  PUT de castração e upload multipart (`scope=medicalExam`, `resourceType=MEDICAL_EXAM`)
  em `/storage/objects`. Todas invalidas a query do prontuário e do pet.

## Componentes

- `MedicalRecordSection` — seção “Saúde” do detalhe do pet: selos derivados, lista de
  vacinas (vencidas destacadas), condições/cuidados, exames e observações apenas na
  visão completa. Prontuário vazio exibe exatamente “Ainda não há registros de saúde”.
- `MedicalRecordHistory` — quem criou/atualizou cada item e quando.
- `OrganizationMedicalRecordPage` — página `/organizacao/pets/:petId/prontuario` com
  formulários `react-hook-form` + `zodResolver` usando os schemas compartilhados.
  A rota é registrada fora deste módulo.

## Mock server

`apps/web/mock-server` expõe os mesmos endpoints com dados em `medicalRecords` e
`storageObjects` no seed, inclusive upload multipart simulado com URL assinada.
