-- Agendamento de entrevista e visita domiciliar (#21).
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "proposedSlots" TEXT[],
    "confirmedAt" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_requestId_createdAt_idx" ON "Appointment"("requestId", "createdAt");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AdoptionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
