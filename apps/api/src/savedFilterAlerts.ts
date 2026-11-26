import { prisma } from './db.js'
import { enqueueDomainEvent, NEW_MATCHING_PET } from './events.js'
import type { Prisma } from './generated/prisma/client.js'
import { organizationMemberIds } from './notificationService.js'

/**
 * Produtos dos alertas de buscas salvas (#31 / FIL-03..08).
 *
 * O produtor roda na mesma transação da publicação (ou da volta para
 * `DISPONIVEL`) e apenas enfileira `NewMatchingPet` no outbox: a decisão de
 * gravar notificação/e-mail continua sendo do consumidor de notificações.
 */
export interface MatchingPet {
  id: string
  name: string
  species: string
  size: string
  sex: string
  city: string
  organizationId: string
}

export interface NotifyMatchingSavedFiltersOptions {
  tx?: Prisma.TransactionClient
}

export interface MatchingPetEventPayload {
  userId: string
  petId: string
  petName: string
  filterId?: string
}

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')

const CRITERIA_TEXT_FIELDS = [
  'name',
  'species',
  'breed',
  'size',
  'sex',
  'city',
  'summary',
  'description',
] as const
const CRITERIA_EXACT_FIELDS = ['species', 'sex', 'city'] as const

/** Critérios vêm de JSON: nada aqui pode confiar em tipos ou em chaves herdadas. */
function criteriaFrom(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return { ...(value as Record<string, unknown>) }
}

/**
 * Todos os critérios presentes são AND. Critérios vazios/desconhecidos não
 * contam como match: um filtro sem critério nunca dispara alerta (FIL-03).
 */
function matchesCriteria(criteria: Record<string, unknown>, pet: MatchingPet): boolean {
  let evaluated = 0
  const record = pet as unknown as Record<string, unknown>

  const search = criteria.search
  if (typeof search === 'string' && normalize(search)) {
    evaluated += 1
    const term = normalize(search)
    const found = CRITERIA_TEXT_FIELDS.some((field) => normalize(record[field]).includes(term))
    if (!found) return false
  }

  for (const field of CRITERIA_EXACT_FIELDS) {
    const expected = criteria[field]
    if (typeof expected === 'string' && normalize(expected)) {
      evaluated += 1
      if (normalize(record[field]) !== normalize(expected)) return false
    }
  }

  if (Array.isArray(criteria.size) && criteria.size.length) {
    evaluated += 1
    const sizes = criteria.size.map(normalize)
    if (!sizes.includes(normalize(pet.size))) return false
  }

  return evaluated > 0
}

/** Resolve o nome da organização a partir do `organizationId` do pet (FIL-08). */
async function organizationNameFor(tx: Prisma.TransactionClient, organizationId: string) {
  if (!organizationId) return ''
  const organization = await tx.organization.findFirst({
    where: { OR: [{ id: organizationId }, { name: organizationId }] },
    select: { name: true },
  })
  return organization?.name ?? organizationId
}

/**
 * Avalia as buscas salvas ativas e publica, no máximo, um evento por usuário.
 * A deduplicação é por `userId`, não por filtro: vários filtros do mesmo dono
 * que batem com o mesmo pet geram um único `NewMatchingPet` (FIL-05).
 */
export async function notifyMatchingSavedFilters(
  pet: MatchingPet,
  options: NotifyMatchingSavedFiltersOptions = {},
): Promise<MatchingPetEventPayload[]> {
  const collect = async (tx: Prisma.TransactionClient) => {
    const filters = await tx.savedFilter.findMany({
      where: { active: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const organizationName = await organizationNameFor(tx, pet.organizationId)
    const memberIds = new Set(
      organizationName ? await organizationMemberIds(organizationName, '') : [],
    )

    const byUser = new Map<string, MatchingPetEventPayload>()
    for (const filter of filters) {
      if (memberIds.has(filter.userId)) continue
      const criteria = criteriaFrom(filter.criteria)
      if (!criteria || !matchesCriteria(criteria, pet)) continue
      // Mantém o primeiro filtro compatível, em ordem determinística.
      if (byUser.has(filter.userId)) continue
      byUser.set(filter.userId, {
        userId: filter.userId,
        petId: pet.id,
        petName: pet.name.trim().slice(0, 200) || 'pet',
        filterId: filter.id,
      })
    }

    const payloads = [...byUser.values()]
    for (const payload of payloads) {
      await enqueueDomainEvent(tx, NEW_MATCHING_PET, payload)
    }
    return payloads
  }

  if (options.tx) return collect(options.tx)
  return prisma.$transaction((tx) => collect(tx))
}

export default notifyMatchingSavedFilters
