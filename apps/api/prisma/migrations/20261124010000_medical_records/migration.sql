-- Prontuário médico do pet (#29): indicadores passam a ser derivados.
CREATE TYPE "HealthConditionType" AS ENUM ('CRONICA', 'EM_TRATAMENTO', 'TRATADA');

CREATE TABLE "MedicalRecord" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL DEFAULT 'SYSTEM',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL DEFAULT 'SYSTEM',
    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL, "medicalRecordId" TEXT NOT NULL, "name" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL, "nextDoseAt" TIMESTAMP(3), "batch" TEXT,
    "veterinarian" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL, "updatedById" TEXT NOT NULL,
    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Neutering" (
    "id" TEXT NOT NULL, "medicalRecordId" TEXT NOT NULL, "done" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL, "updatedById" TEXT NOT NULL,
    CONSTRAINT "Neutering_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HealthCondition" (
    "id" TEXT NOT NULL, "medicalRecordId" TEXT NOT NULL, "name" TEXT NOT NULL,
    "type" "HealthConditionType" NOT NULL, "notes" TEXT NOT NULL DEFAULT '',
    "careRequired" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL, "updatedById" TEXT NOT NULL,
    CONSTRAINT "HealthCondition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL, "medicalRecordId" TEXT NOT NULL, "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL, "result" TEXT NOT NULL, "attachment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL, "updatedById" TEXT NOT NULL,
    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicalRecord_petId_key" ON "MedicalRecord"("petId");
CREATE INDEX "Vaccination_medicalRecordId_appliedAt_idx" ON "Vaccination"("medicalRecordId", "appliedAt");
CREATE UNIQUE INDEX "Neutering_medicalRecordId_key" ON "Neutering"("medicalRecordId");
CREATE INDEX "HealthCondition_medicalRecordId_type_idx" ON "HealthCondition"("medicalRecordId", "type");
CREATE INDEX "Exam_medicalRecordId_date_idx" ON "Exam"("medicalRecordId", "date");

ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Neutering" ADD CONSTRAINT "Neutering_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthCondition" ADD CONSTRAINT "HealthCondition_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Converte os booleanos existentes em registros equivalentes antes de removê-los.
INSERT INTO "MedicalRecord" ("id", "petId", "createdAt", "createdById", "updatedAt", "updatedById")
SELECT 'medical-' || "id", "id", CURRENT_TIMESTAMP, 'SYSTEM', CURRENT_TIMESTAMP, 'SYSTEM' FROM "Pet";

INSERT INTO "Vaccination" ("id", "medicalRecordId", "name", "appliedAt", "nextDoseAt", "createdById", "updatedAt", "updatedById")
SELECT 'vaccine-' || "id", 'medical-' || "id", 'Vacinação em dia', "createdAt", NULL, 'SYSTEM', CURRENT_TIMESTAMP, 'SYSTEM'
FROM "Pet" WHERE "vaccinated" = true;

INSERT INTO "Neutering" ("id", "medicalRecordId", "done", "date", "createdById", "updatedAt", "updatedById")
SELECT 'neutering-' || "id", 'medical-' || "id", "neutered", CASE WHEN "neutered" THEN "createdAt" ELSE NULL END,
       'SYSTEM', CURRENT_TIMESTAMP, 'SYSTEM' FROM "Pet";

INSERT INTO "HealthCondition" ("id", "medicalRecordId", "name", "type", "notes", "careRequired", "createdById", "updatedAt", "updatedById")
SELECT 'condition-' || "id", 'medical-' || "id", 'Cuidados especiais informados', 'CRONICA',
       'Importado do cadastro anterior do pet.', true, 'SYSTEM', CURRENT_TIMESTAMP, 'SYSTEM'
FROM "Pet" WHERE "specialCare" = true;

ALTER TABLE "Pet" DROP COLUMN "vaccinated", DROP COLUMN "neutered", DROP COLUMN "specialCare";
