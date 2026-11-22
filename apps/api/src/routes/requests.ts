import { questionnaireSchema } from '@adotapet/shared'
import { Router } from 'express'
import {
  currentUser,
  getProfile,
  isChatParticipant,
  messagesForRequest,
  presentChatMessage,
  unreadChatCount,
  withPet,
} from '../context.js'
import { prisma } from '../db.js'
import { enqueueNewRequestForOrganization } from '../events.js'
import { Prisma } from '../generated/prisma/client.js'
import type { FieldError } from '../http.js'
import { isBlank, list, sendError } from '../http.js'
import { asRecord } from '../validation.js'

export const requestsRouter = Router()

const ACTIVE_STATUSES = ['Enviada', 'Em análise', 'Aprovada']
const CANCELLABLE_STATUSES = ['Enviada', 'Em análise']
const FINAL_REQUEST_STATUSES = ['Aprovada', 'Recusada', 'Cancelada']
const AVAILABLE_PET_STATUS = 'DISPONIVEL'

/** Próximo número de solicitação no padrão `SOL-0000`, gerado pelo banco (#50/REQ-08). */
async function nextRequestId(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ value: bigint | number }>>`
    SELECT nextval('adoption_request_id_seq') AS value
  `
  return `SOL-${String(Number(rows[0]?.value ?? 0)).padStart(4, '0')}`
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

requestsRouter.post('/requests', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const body = asRecord(req.body)
  const parsed = questionnaireSchema.safeParse(body?.answers)
  const missingPetId = isBlank(body?.petId)

  // REQ-01: o mesmo schema do questionário do frontend, com os erros no `details`.
  if (missingPetId || !parsed.success) {
    const details: FieldError[] = []
    if (missingPetId) details.push({ field: 'petId', message: 'petId é obrigatório' })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.')
        details.push({
          field: path ? `answers.${path}` : 'answers',
          message: issue.message,
        })
      }
    }
    return sendError(res, 400, 'Validação falhou', details)
  }

  const pet = await prisma.pet.findUnique({ where: { id: String(body?.petId) } })
  if (!pet) return sendError(res, 404, 'Pet não encontrado')
  // REQ-03: adotado/arquivado não recebe nova solicitação.
  if (pet.status !== AVAILABLE_PET_STATUS) {
    return sendError(res, 409, 'Este pet não está mais disponível para adoção')
  }

  // REQ-04: o perfil é a fonte da verdade, calculada pelo backend (#18).
  const profile = await getProfile(userId)
  if (!profile.isComplete) {
    return sendError(
      res,
      422,
      'Complete seu perfil de adotante antes de solicitar uma adoção',
      profile.missingFields.map((field) => ({
        field,
        message: 'Campo obrigatório do perfil não preenchido ou inválido',
      })),
    )
  }

  const duplicate = await prisma.adoptionRequest.findFirst({
    where: { userId, petId: pet.id, status: { in: ACTIVE_STATUSES } },
  })
  if (duplicate) return sendError(res, 409, 'Você já possui uma solicitação ativa para este pet')

  const date = new Date()
  let request
  try {
    request = await prisma.$transaction(async (tx) => {
      const created = await tx.adoptionRequest.create({
        data: {
          id: await nextRequestId(tx),
          userId,
          petId: pet.id,
          status: 'Enviada',
          date,
          message: 'Sua solicitação foi enviada e aguarda o início da análise.',
          // REQ-06: somente as respostas known são gravadas; status/id/adopterId
          // enviados no corpo são descartados pelo schema do Zod.
          answers: parsed.data,
        },
      })
      // REQ-10: evento e solicitação na mesma transação (JOB-07).
      await enqueueNewRequestForOrganization(tx, {
        requestId: created.id,
        petId: pet.id,
        adopterId: userId,
        organization: pet.organization,
        createdAt: date.toISOString(),
      })
      return created
    })
  } catch (error) {
    // REQ-07: o índice único parcial é a última linha de defesa contra a corrida.
    if (isUniqueViolation(error)) {
      return sendError(res, 409, 'Você já possui uma solicitação ativa para este pet')
    }
    throw error
  }
  res.status(201).json(await withPet(request))
})

requestsRouter.get('/me/requests', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const requests = await prisma.adoptionRequest.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  })
  const data = await Promise.all(
    requests.map(async (request) => ({
      ...(await withPet(request)),
      unreadMessageCount: await unreadChatCount(request.id, userId),
    })),
  )
  res.json(list(data))
})

requestsRouter.get('/requests/:id', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const request = await prisma.adoptionRequest.findUnique({ where: { id: req.params.id } })
  if (!request) return sendError(res, 404, 'Solicitação não encontrada')
  // REQ-05: dono ou membro da organização do pet; ninguém mais.
  if (!(await isChatParticipant(request, userId))) {
    return sendError(res, 403, 'Você não tem acesso a esta solicitação')
  }
  res.json(await withPet(request))
})

requestsRouter.post('/requests/:id/transitions', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const request = await prisma.adoptionRequest.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!request) return sendError(res, 404, 'Solicitação não encontrada')

  const body = asRecord(req.body)
  const to = String(body?.to ?? '').toUpperCase()
  if (to !== 'CANCELADA') {
    return sendError(res, 400, 'Transição não suportada', [
      { field: 'to', message: 'Apenas CANCELADA é permitida' },
    ])
  }
  if (!CANCELLABLE_STATUSES.includes(request.status)) {
    return sendError(
      res,
      409,
      `Não é possível cancelar uma solicitação com status "${request.status}"`,
    )
  }
  const updated = await prisma.adoptionRequest.update({
    where: { id: request.id },
    data: { status: 'Cancelada', message: 'Solicitação cancelada por você.' },
  })
  res.json(await withPet(updated))
})

requestsRouter.get('/requests/:id/messages', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const adoptionRequest = await prisma.adoptionRequest.findUnique({
    where: { id: req.params.id },
  })
  if (!adoptionRequest) return sendError(res, 404, 'Solicitação não encontrada')
  if (!(await isChatParticipant(adoptionRequest, userId))) {
    return sendError(res, 403, 'Somente os participantes podem acessar esta conversa')
  }
  if (Object.keys(req.query).some((key) => key !== 'cursor')) {
    return sendError(res, 400, 'Parâmetro desconhecido', [
      { field: 'query', message: 'Apenas cursor é aceito' },
    ])
  }

  const allMessages = await messagesForRequest(adoptionRequest.id)
  const cursor = req.query.cursor
  let end = allMessages.length
  if (cursor !== undefined) {
    if (typeof cursor !== 'string') {
      return sendError(res, 400, 'Cursor inválido', [
        { field: 'cursor', message: 'Informe um cursor válido' },
      ])
    }
    end = allMessages.findIndex(({ id }) => id === cursor)
    if (end < 0) {
      return sendError(res, 400, 'Cursor inválido', [
        { field: 'cursor', message: 'O cursor não pertence a esta conversa' },
      ])
    }
  }
  const start = Math.max(0, end - 20)
  const page = allMessages.slice(start, end)
  res.json({
    data: await Promise.all(page.map((message) => presentChatMessage(message, userId))),
    unreadCount: await unreadChatCount(adoptionRequest.id, userId),
    nextCursor: start > 0 ? (page[0]?.id ?? null) : null,
  })
})

requestsRouter.post('/requests/:id/messages', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const adoptionRequest = await prisma.adoptionRequest.findUnique({
    where: { id: req.params.id },
  })
  if (!adoptionRequest) return sendError(res, 404, 'Solicitação não encontrada')
  if (!(await isChatParticipant(adoptionRequest, userId))) {
    return sendError(res, 403, 'Somente os participantes podem enviar mensagens')
  }
  if (FINAL_REQUEST_STATUSES.includes(adoptionRequest.status)) {
    return sendError(res, 409, 'O chat está bloqueado para solicitações encerradas')
  }

  const body = asRecord(req.body)
  if (
    !body ||
    Object.keys(body).some((key) => key !== 'body') ||
    typeof body.body !== 'string' ||
    !body.body.trim() ||
    body.body.length > 2000
  ) {
    return sendError(res, 400, 'Mensagem inválida', [
      { field: 'body', message: 'A mensagem deve ter entre 1 e 2000 caracteres' },
    ])
  }

  const rows = await prisma.chatMessage.findMany({ select: { id: true } })
  const nextNumber =
    rows.reduce((max, message) => Math.max(max, Number(message.id.replace(/\D/g, '')) || 0), 0) + 1
  const message = await prisma.chatMessage.create({
    data: {
      id: `MSG-${String(nextNumber).padStart(4, '0')}`,
      requestId: adoptionRequest.id,
      authorId: userId,
      body: body.body,
      createdAt: new Date(),
      readAt: null,
    },
  })
  res.status(201).json(await presentChatMessage(message, userId))
})

requestsRouter.patch('/requests/:id/messages/read', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const adoptionRequest = await prisma.adoptionRequest.findUnique({
    where: { id: req.params.id },
  })
  if (!adoptionRequest) return sendError(res, 404, 'Solicitação não encontrada')
  if (!(await isChatParticipant(adoptionRequest, userId))) {
    return sendError(res, 403, 'Somente os participantes podem marcar mensagens como lidas')
  }
  await prisma.chatMessage.updateMany({
    where: { requestId: adoptionRequest.id, authorId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  })
  res.status(204).end()
})
