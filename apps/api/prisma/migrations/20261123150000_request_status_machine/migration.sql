-- Máquina de estados da solicitação (#20): status passa a ser código controlado.

ALTER TABLE "AdoptionRequest" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "AdoptionRequest"
SET "status" = CASE "status"
  WHEN 'Enviada' THEN 'ENVIADA'
  WHEN 'Em análise' THEN 'ANALISE_QUESTIONARIO'
  WHEN 'Aprovada' THEN 'APROVADA'
  WHEN 'Recusada' THEN 'RECUSADA'
  WHEN 'Cancelada' THEN 'CANCELADA'
  ELSE "status"
END;

-- O índice parcial de duplicidade também usa os novos códigos ativos.
DROP INDEX IF EXISTS "AdoptionRequest_userId_petId_active_key";
CREATE UNIQUE INDEX "AdoptionRequest_userId_petId_active_key"
  ON "AdoptionRequest"("userId", "petId")
  WHERE "status" IN (
    'ENVIADA', 'ANALISE_QUESTIONARIO', 'ENTREVISTA', 'VISITA_DOMICILIAR', 'DECISAO_FINAL', 'APROVADA'
  );

CREATE TABLE "RequestStatusHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequestStatusHistory_requestId_createdAt_idx"
  ON "RequestStatusHistory"("requestId", "createdAt");

ALTER TABLE "RequestStatusHistory"
  ADD CONSTRAINT "RequestStatusHistory_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "AdoptionRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
