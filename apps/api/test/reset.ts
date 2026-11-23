import { prisma } from '../src/db.js'

/** Limpeza entre testes do banco dedicado (#47 / INF-12). */
export async function resetTestDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RefreshToken", "NotificationPreference", "Notification", "EventOutbox", "JobEffect",
      "SavedFilter", "StorageObject", "CheckIn", "FollowUpPlan", "Adoption", "Membership",
      "Organization",
      "ChatMessage", "RequestStatusHistory", "AdoptionRequest", "Favorite", "Pet",
      "GuardianProfile", "AdopterProfile", "User"
    RESTART IDENTITY CASCADE
  `)
}
