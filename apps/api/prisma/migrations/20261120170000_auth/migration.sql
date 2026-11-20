-- Autenticação (#48): papel na plataforma, hash da senha e refresh tokens.

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USUARIO', 'MODERADOR');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USUARIO',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- e-mail normalizado em minúsculas é único (AUTH-01/AUTH-02)
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
