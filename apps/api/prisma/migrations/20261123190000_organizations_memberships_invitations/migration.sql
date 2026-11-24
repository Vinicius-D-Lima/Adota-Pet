-- Convites seguros para organizações (#27).
CREATE TYPE "InvitationStatus" AS ENUM ('PENDENTE', 'ACEITO', 'EXPIRADO', 'REVOGADO');

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_organizationId_status_idx" ON "Invitation"("organizationId", "status");
CREATE INDEX "Invitation_email_status_idx" ON "Invitation"("email", "status");
CREATE UNIQUE INDEX "Organization_cnpj_key" ON "Organization"("cnpj");

ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- As quatro organizações do catálogo antigo passam a ser registros reais.
INSERT INTO "Organization" ("id", "name", "initials") VALUES
  ('org-' || md5('Instituto Patinhas'), 'Instituto Patinhas', 'IP'),
  ('org-' || md5('Lar Animal'), 'Lar Animal', 'LA'),
  ('org-' || md5('Gatinhos da Vila'), 'Gatinhos da Vila', 'GV'),
  ('org-' || md5('Amigos de Quatro Patas'), 'Amigos de Quatro Patas', 'AQ')
ON CONFLICT ("name") DO NOTHING;

-- Também preserva qualquer organização adicional já gravada como texto em Pet.
INSERT INTO "Organization" ("id", "name", "initials")
SELECT
    'org-' || md5(pet."organization"),
    pet."organization",
    MIN(pet."organizationInitials")
FROM "Pet" AS pet
WHERE btrim(pet."organization") <> ''
GROUP BY pet."organization"
ON CONFLICT ("name") DO NOTHING;

ALTER TABLE "Pet" ADD COLUMN "organizationId" TEXT;

UPDATE "Pet" AS pet
SET "organizationId" = organization."id"
FROM "Organization" AS organization
WHERE organization."name" = pet."organization";

ALTER TABLE "Pet" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Pet_organizationId_idx" ON "Pet"("organizationId");
ALTER TABLE "Pet"
ADD CONSTRAINT "Pet_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Pet" DROP COLUMN "organization";
ALTER TABLE "Pet" DROP COLUMN "organizationInitials";
