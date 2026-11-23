-- Papel da pessoa na instituição (#26/#28). O default ADMIN preserva o
-- comportamento das contas GUARDIAN já existentes; VOLUNTEER é explícito.
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'VOLUNTEER');

ALTER TABLE "User"
  ADD COLUMN "organizationRole" "OrganizationRole" NOT NULL DEFAULT 'ADMIN';
