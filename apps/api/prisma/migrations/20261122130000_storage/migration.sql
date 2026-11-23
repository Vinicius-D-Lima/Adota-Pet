-- Armazenamento de arquivos (#94): metadados dos objetos e seu vínculo com o
-- registro dono. O bucket permanece privado; esta tabela é a única fonte de
-- autorização para emissão de URLs assinadas e para limpeza de órfãos.
CREATE TABLE "StorageObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageObject_key_key" ON "StorageObject"("key");
CREATE INDEX "StorageObject_resourceType_resourceId_idx" ON "StorageObject"("resourceType", "resourceId");
CREATE INDEX "StorageObject_ownerId_idx" ON "StorageObject"("ownerId");
