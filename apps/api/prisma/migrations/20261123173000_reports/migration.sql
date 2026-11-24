CREATE TYPE "ReportTargetType" AS ENUM ('USUARIO', 'ORGANIZACAO', 'ADOCAO', 'PET', 'AVALIACAO');
CREATE TYPE "ReportCategory" AS ENUM ('MAUS_TRATOS', 'ABANDONO', 'FRAUDE', 'CONTEUDO_IMPROPRIO', 'OUTRO');
CREATE TYPE "ReportStatus" AS ENUM ('ABERTA', 'EM_ANALISE', 'PROCEDENTE', 'IMPROCEDENTE', 'ARQUIVADA');

ALTER TABLE "GuardianProfile"
  ADD COLUMN "reputation" DOUBLE PRECISION,
  ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Review" (
  "id" TEXT NOT NULL,
  "adoptionId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  "hiddenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "category" "ReportCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'ABERTA',
  "resolution" TEXT,
  "moderatorId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_adoptionId_reviewerId_key" ON "Review"("adoptionId", "reviewerId");
CREATE INDEX "Review_organizationId_hiddenAt_idx" ON "Review"("organizationId", "hiddenAt");
CREATE INDEX "Report_reporterId_createdAt_idx" ON "Report"("reporterId", "createdAt");
CREATE INDEX "Report_status_category_createdAt_idx" ON "Report"("status", "category", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- Evita duplicidade inclusive sob concorrência; a restrição deixa de valer
-- automaticamente quando a denúncia sai de ABERTA/EM_ANALISE.
CREATE UNIQUE INDEX "Report_open_target_key"
  ON "Report"("reporterId", "targetType", "targetId")
  WHERE "status" IN ('ABERTA', 'EM_ANALISE');

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Review_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Report_moderatorId_fkey"
  FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
