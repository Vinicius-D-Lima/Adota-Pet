-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "cpf" TEXT,
    "birthDate" TEXT,
    "zipCode" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "document" TEXT,
    "organizationName" TEXT,
    "guardianType" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADOTANTE',
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdopterProfile" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "cpf" TEXT,
    "birthDate" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "zipCode" TEXT,
    "address" TEXT,
    "housing" TEXT,
    "hasOutdoorArea" BOOLEAN,
    "dailyTime" TEXT,
    "activityLevel" TEXT,
    "hasChildren" BOOLEAN,
    "hasOtherPets" BOOLEAN,
    "experience" TEXT,
    "acceptsSpecialCare" BOOLEAN,
    "preferredSpecies" TEXT,
    "preferredSize" TEXT,

    CONSTRAINT "AdopterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianProfile" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guardianType" TEXT,
    "displayName" TEXT,
    "legalName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "zipCode" TEXT,
    "address" TEXT,
    "city" TEXT,
    "description" TEXT,
    "acceptsTerms" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GuardianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "ageLabel" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "traits" TEXT[],
    "energy" TEXT NOT NULL,
    "space" TEXT NOT NULL,
    "children" BOOLEAN NOT NULL,
    "otherPets" BOOLEAN NOT NULL,
    "specialCare" BOOLEAN NOT NULL,
    "vaccinated" BOOLEAN NOT NULL,
    "neutered" BOOLEAN NOT NULL,
    "organization" TEXT NOT NULL,
    "organizationInitials" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdoptionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "answers" JSONB,
    "interview" JSONB,
    "rejectionReason" TEXT,

    CONSTRAINT "AdoptionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL,
    "email" BOOLEAN NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","type")
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdopterProfile_userId_key" ON "AdopterProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianProfile_userId_key" ON "GuardianProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_petId_key" ON "Favorite"("userId", "petId");

-- CreateIndex
CREATE INDEX "ChatMessage_requestId_createdAt_idx" ON "ChatMessage"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedFilter_userId_createdAt_idx" ON "SavedFilter"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdopterProfile" ADD CONSTRAINT "AdopterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionRequest" ADD CONSTRAINT "AdoptionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdoptionRequest" ADD CONSTRAINT "AdoptionRequest_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AdoptionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFilter" ADD CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
