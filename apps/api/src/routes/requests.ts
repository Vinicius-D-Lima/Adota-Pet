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
import type { FieldError } from '../http.js'
import { isBlank, list, sendError } from '../http.js'
import { asRecord } from '../validation.js'

export const requestsRouter = Router()

const ACTIVE_STATUSES = ['Enviada', 'Em análise', 'Aprovada']
const CANCELLABLE_STATUSES = ['Enviada', 'Em análise']
const FINAL_REQUEST_STATUSES = ['Aprovada', 'Recusada', 'Cancelada']

/** Próximo número de solicitação no padrão `SOL-0000` (começa em 1043). */
async function nextRequestId(): Promise<string> {
  const rows = await prisma.adoptionRequest.findMany({ select: { id: true } })
  const lastNumber = rows.reduce(
    (max, { id }) => Math.max(max, Number(/^SOL-(\d+)$/.exec(id)?.[1] ?? 0)),
    1042,
  )
  return `SOL-${String(lastNumber + 1).padStart(4, '0')}`
}

requestsRouter.post('/requests', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const body = asRecord(req.body)
  const petId = body?.petId
  const answers = body?.answers
  const details: FieldError[] = []

  if (isBlank(petId)) details.push({ field: 'petId', message: 'petId é obrigatório' })
  const given = answers && typeof answers === 'object' ? (answers as Record<string, unknown>) : {}
  if (!answers || typeof answers !== 'object') {
    details.push({ field: 'answers', message: 'answers é obrigatório' })
  }
  const minLength: Record<string, number> = { motivation: 20, routine: 20, adaptation: 15 }
  for (const [key, min] of Object.entries(minLength)) {
    const value = given[key]
    if (isBlank(value) || String(value).trim().length < min) {
      details.push({
        field: `answers.${key}`,
        message: `${key} deve ter ao menos ${min} caracteres`,
      })
    }
  }
  if (isBlank(given.aloneTime))
    details.push({ field: 'answers.aloneTime', message: 'aloneTime é obrigatório' })
  for (const key of ['costs', 'commitment']) {
    if (given[key] !== true)
      details.push({ field: `answers.${key}`, message: `${key} precisa ser confirmado` })
  }
  if (details.length) return sendError(res, 400, 'Validação falhou', details)

  const pet = await prisma.pet.findUnique({ where: { id: String(petId) } })
  if (!pet) return sendError(res, 404, 'Pet não encontrado')

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

  const request = await prisma.adoptionRequest.create({
    data: {
      id: await nextRequestId(),
      userId,
      petId: pet.id,
      status: 'Enviada',
      date: new Date(),
      message: 'Sua solicitação foi enviada e aguarda o início da análise.',
      answers: {
        motivation: String(given.motivation),
        routine: String(given.routine),
        aloneTime: String(given.aloneTime),
        adaptation: String(given.adaptation),
        costs: true,
        commitment: true,
      },
    },
  })
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
  const request = await prisma.adoptionRequest.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!request) return sendError(res, 404, 'Solicitação não encontrada')
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
