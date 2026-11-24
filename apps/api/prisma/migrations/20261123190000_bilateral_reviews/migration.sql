CREATE TYPE "ReviewDirection" AS ENUM ('ADOPTER_TO_ORGANIZATION', 'ORGANIZATION_TO_ADOPTER');

ALTER TABLE "Organization"
  ADD COLUMN "reputation" DOUBLE PRECISION,
  ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Review" DROP CONSTRAINT "Review_organizationId_fkey";
ALTER TABLE "Review" RENAME COLUMN "organizationId" TO "revieweeOrganizationId";
ALTER TABLE "Review"
  ADD COLUMN "revieweeId" TEXT,
  ADD COLUMN "direction" "ReviewDirection" NOT NULL DEFAULT 'ADOPTER_TO_ORGANIZATION';

UPDATE "Review" AS review
SET
  "direction" = CASE
    WHEN review."reviewerId" = adoption."adopterId" THEN 'ADOPTER_TO_ORGANIZATION'::"ReviewDirection"
    ELSE 'ORGANIZATION_TO_ADOPTER'::"ReviewDirection"
  END,
  "revieweeId" = CASE
    WHEN review."reviewerId" = adoption."adopterId" THEN NULL
    ELSE adoption."adopterId"
  END,
  "revieweeOrganizationId" = CASE
    WHEN review."reviewerId" = adoption."adopterId" THEN adoption."organizationId"
    ELSE NULL
  END
FROM "Adoption" AS adoption
WHERE review."adoptionId" = adoption."id";

ALTER TABLE "Review"
  ALTER COLUMN "revieweeOrganizationId" DROP NOT NULL,
  ALTER COLUMN "direction" DROP DEFAULT;

DROP INDEX "Review_adoptionId_reviewerId_key";
DROP INDEX "Review_organizationId_hiddenAt_idx";

CREATE UNIQUE INDEX "Review_adoptionId_direction_key" ON "Review"("adoptionId", "direction");
CREATE INDEX "Review_revieweeId_hiddenAt_createdAt_idx"
  ON "Review"("revieweeId", "hiddenAt", "createdAt");
CREATE INDEX "Review_revieweeOrganizationId_hiddenAt_createdAt_idx"
  ON "Review"("revieweeOrganizationId", "hiddenAt", "createdAt");

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_adoptionId_fkey"
  FOREIGN KEY ("adoptionId") REFERENCES "Adoption"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Review_revieweeId_fkey"
  FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Review_revieweeOrganizationId_fkey"
  FOREIGN KEY ("revieweeOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Review_reviewee_target_check"
  CHECK (
    ("direction" = 'ADOPTER_TO_ORGANIZATION' AND "revieweeId" IS NULL AND "revieweeOrganizationId" IS NOT NULL)
    OR
    ("direction" = 'ORGANIZATION_TO_ADOPTER' AND "revieweeId" IS NOT NULL AND "revieweeOrganizationId" IS NULL)
  );
