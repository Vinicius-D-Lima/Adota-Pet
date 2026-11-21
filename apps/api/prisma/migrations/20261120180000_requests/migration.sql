-- Criação de solicitações de adoção (#50).

-- Status do pet: apenas DISPONIVEL pode receber uma nova solicitação.
ALTER TABLE "Pet" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DISPONIVEL';

-- Outbox: evento gravado na mesma transação da solicitação, consumido por #30/#95.
CREATE TABLE "EventOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventOutbox_type_createdAt_idx" ON "EventOutbox"("type", "createdAt");

-- Uma solicitação ativa por adotante e pet, garantida também no banco (REQ-07).
CREATE UNIQUE INDEX "AdoptionRequest_userId_petId_active_key"
    ON "AdoptionRequest"("userId", "petId")
    WHERE "status" IN ('Enviada', 'Em análise', 'Aprovada');

-- ID crescente gerado pelo servidor: nunca repete, mesmo com criações concorrentes (REQ-08).
CREATE SEQUENCE IF NOT EXISTS adoption_request_id_seq START WITH 1043;
SELECT setval(
    'adoption_request_id_seq',
    GREATEST(
        COALESCE((SELECT MAX(SUBSTRING("id" FROM 'SOL-([0-9]+)$')::integer) FROM "AdoptionRequest"), 1042),
        1042
    ),
    true
);
