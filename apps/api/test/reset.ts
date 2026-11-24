import { prisma } from '../src/db.js'

/** Limpeza entre testes do banco dedicado (#47 / INF-12). */
export async function resetTestDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RefreshToken", "NotificationPreference", "Notification", "EventOutbox", "JobEffect",
      "SavedFilter", "StorageObject", "Report", "Review", "CheckIn", "FollowUpPlan", "Adoption", "Membership","Invitation",
      "Organization",
      "ChatMessage", "RequestStatusHistory", "AdoptionRequest", "Favorite",
      "Exam", "HealthCondition", "Neutering", "Vaccination", "MedicalRecord", "Pet",
      "GuardianProfile", "AdopterProfile", "User"
    RESTART IDENTITY CASCADE
  `)
}
