-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ATIVO', 'REMOVIDO');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'ATRASADO', 'REVISADO');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "cnpj" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'VOLUNTEER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ATIVO',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adoption" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "adopterId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adoption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpPlan" (
    "id" TEXT NOT NULL,
    "adoptionId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FollowUpPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "adoptionId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CheckInStatus" NOT NULL DEFAULT 'PENDENTE',
    "submittedAt" TIMESTAMP(3),
    "report" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewerComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Membership_organizationId_status_role_idx" ON "Membership"("organizationId", "status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Adoption_requestId_key" ON "Adoption"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Adoption_petId_key" ON "Adoption"("petId");

-- CreateIndex
CREATE INDEX "Adoption_adopterId_adoptedAt_idx" ON "Adoption"("adopterId", "adoptedAt");

-- CreateIndex
CREATE INDEX "Adoption_organizationId_adoptedAt_idx" ON "Adoption"("organizationId", "adoptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpPlan_adoptionId_key" ON "FollowUpPlan"("adoptionId");

-- CreateIndex
CREATE INDEX "CheckIn_adoptionId_dueDate_idx" ON "CheckIn"("adoptionId", "dueDate");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adoption" ADD CONSTRAINT "Adoption_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AdoptionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adoption" ADD CONSTRAINT "Adoption_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adoption" ADD CONSTRAINT "Adoption_adopterId_fkey" FOREIGN KEY ("adopterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adoption" ADD CONSTRAINT "Adoption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpPlan" ADD CONSTRAINT "FollowUpPlan_adoptionId_fkey" FOREIGN KEY ("adoptionId") REFERENCES "Adoption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpPlan" ADD CONSTRAINT "FollowUpPlan_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_adoptionId_fkey" FOREIGN KEY ("adoptionId") REFERENCES "Adoption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve organizations currently stored as text on pets or guardian profiles.
INSERT INTO "Organization" ("id", "name", "initials")
SELECT
    'org-' || md5(pet."organization"),
    pet."organization",
    MIN(pet."organizationInitials")
FROM "Pet" AS pet
WHERE btrim(pet."organization") <> ''
GROUP BY pet."organization"
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Organization" ("id", "name", "initials")
SELECT
    'org-' || md5(organization_name."name"),
    organization_name."name",
    upper(left(organization_name."name", 2))
FROM (
    SELECT COALESCE(
        NULLIF(guardian."displayName", ''),
        NULLIF(guardian."legalName", ''),
        NULLIF(app_user."organizationName", '')
    ) AS "name"
    FROM "User" AS app_user
    LEFT JOIN "GuardianProfile" AS guardian ON guardian."userId" = app_user."id"
    WHERE app_user."roles" @> ARRAY['GUARDIAN']::TEXT[]
) AS organization_name
WHERE organization_name."name" IS NOT NULL AND btrim(organization_name."name") <> ''
ON CONFLICT ("name") DO NOTHING;

-- Existing guardian profiles become admins of their current organization.
INSERT INTO "Membership" ("id", "userId", "organizationId", "role", "status", "joinedAt")
SELECT
    'membership-' || md5(app_user."id" || organization."id"),
    app_user."id",
    organization."id",
    'ADMIN',
    'ATIVO',
    CURRENT_TIMESTAMP
FROM "User" AS app_user
LEFT JOIN "GuardianProfile" AS guardian ON guardian."userId" = app_user."id"
JOIN "Organization" AS organization
  ON organization."name" = COALESCE(
      NULLIF(guardian."displayName", ''),
      NULLIF(guardian."legalName", ''),
      NULLIF(app_user."organizationName", '')
  )
WHERE app_user."roles" @> ARRAY['GUARDIAN']::TEXT[]
ON CONFLICT ("userId", "organizationId") DO NOTHING;

-- Approved requests already present in the database are formalized as adoptions.
INSERT INTO "Adoption" (
    "id",
    "requestId",
    "petId",
    "adopterId",
    "organizationId",
    "adoptedAt",
    "createdAt"
)
SELECT
    'adoption-' || md5(adoption_request."id"),
    adoption_request."id",
    adoption_request."petId",
    adoption_request."userId",
    organization."id",
    adoption_request."date",
    CURRENT_TIMESTAMP
FROM "AdoptionRequest" AS adoption_request
JOIN "Pet" AS pet ON pet."id" = adoption_request."petId"
JOIN "Organization" AS organization ON organization."name" = pet."organization"
WHERE upper(adoption_request."status") = 'APROVADA'
ORDER BY adoption_request."date", adoption_request."id"
ON CONFLICT DO NOTHING;

UPDATE "Pet" AS pet
SET "status" = 'ADOTADO'
FROM "Adoption" AS adoption
WHERE adoption."petId" = pet."id";
