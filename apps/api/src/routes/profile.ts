import { createAccountSchema } from '@adotapet/shared'
import { Router } from 'express'
import { currentUser, getGuardianProfile, getProfile, publicUser } from '../context.js'
import { prisma } from '../db.js'
import type { FieldError } from '../http.js'
import { sendError } from '../http.js'
import type { Prisma } from '../generated/prisma/client.js'
import { validate } from '../validate.js'
import {
  GUARDIAN_DIGITS,
  GUARDIAN_FIELDS,
  PROFILE_DIGITS,
  PROFILE_FIELDS,
  asRecord,
  digitsOnly,
  guardianFieldError,
  isValidCnpj,
  isValidCpf,
  profileFieldError,
} from '../validation.js'

export const profileRouter = Router()

type ProfileField = (typeof PROFILE_FIELDS)[number]
type GuardianField = (typeof GUARDIAN_FIELDS)[number]
type AccountKey =
  | 'name'
  | 'cpf'
  | 'birthDate'
  | 'email'
  | 'phone'
  | 'zipCode'
  | 'address'
  | 'document'
  | 'city'
  | 'state'
  | 'organizationName'
  | 'guardianType'

const isBooleanField = (key: string) =>
  ['hasOutdoorArea', 'hasChildren', 'hasOtherPets', 'acceptsTerms'].includes(key)

profileRouter.get('/me', async (req, res) => {
  const { user } = await currentUser(req)
  if (!user) return sendError(res, 404, 'Usuário não encontrado')
  res.json(publicUser(user))
})

profileRouter.put('/me/account', validate({ body: createAccountSchema }), async (req, res) => {
  const { id: userId } = await currentUser(req)
  const body = asRecord(req.body)
  if (!body) {
    return sendError(res, 400, 'Corpo da requisição inválido', [
      { field: 'body', message: 'Envie um objeto JSON' },
    ])
  }

  const details: FieldError[] = []
  const normalized: Partial<Record<AccountKey, string>> = {}
  const guardian = body.accountType === 'guardian'
  if (guardian) {
    const guardianType = body.guardianType
    const organization = guardianType === 'ORGANIZATION'
    if (guardianType !== 'INDIVIDUAL' && guardianType !== 'ORGANIZATION') {
      details.push({
        field: 'guardianType',
        message: 'Escolha entre pessoa física e instituição.',
      })
    } else {
      normalized.guardianType = guardianType
    }
    const required = [
      ...(organization ? ['organizationName'] : []),
      'responsibleName',
      'document',
      'email',
      'phone',
      'zipCode',
      'address',
      'city',
      'state',
    ]
    for (const key of required) {
      const value = body[key]
      if (typeof value !== 'string' || !value.trim()) {
        details.push({ field: key, message: `Preencha ${key}.` })
        continue
      }
      if (['organizationName', 'responsibleName'].includes(key) && value.trim().length < 3)
        details.push({ field: key, message: `Preencha ${key}.` })
      else if (key === 'document' && !(organization ? isValidCnpj(value) : isValidCpf(value)))
        details.push({
          field: key,
          message: `Informe um ${organization ? 'CNPJ' : 'CPF'} válido.`,
        })
      else if (key === 'email' && profileFieldError('email', value))
        details.push({ field: key, message: 'Informe um e-mail válido.' })
      else if (key === 'phone' && profileFieldError('phone', value))
        details.push({ field: key, message: 'Informe um telefone com DDD.' })
      else if (key === 'zipCode' && profileFieldError('zipCode', value))
        details.push({ field: key, message: 'Informe um CEP válido.' })
      else if (key === 'address' && profileFieldError('address', value))
        details.push({ field: key, message: 'Informe seu endereço.' })
      else if (key === 'city' && value.trim().length < 2)
        details.push({ field: key, message: 'Informe a cidade.' })
      else if (key === 'state' && value.trim().length !== 2)
        details.push({ field: key, message: 'Use a sigla do estado com 2 letras.' })
      else
        normalized[key as AccountKey] = ['document', 'phone', 'zipCode'].includes(key)
          ? digitsOnly(value)
          : value.trim()
    }
    normalized.organizationName =
      organization && typeof body.organizationName === 'string' ? body.organizationName.trim() : ''
    normalized.name = typeof body.responsibleName === 'string' ? body.responsibleName.trim() : ''
  } else {
    for (const key of [
      'name',
      'cpf',
      'birthDate',
      'email',
      'phone',
      'zipCode',
      'address',
    ] as const) {
      const value = body[key]
      const message = value === undefined ? `Preencha ${key}.` : profileFieldError(key, value)
      if (message) details.push({ field: key, message })
      else
        normalized[key] = PROFILE_DIGITS.includes(key)
          ? digitsOnly(value as string)
          : (value as string).trim()
    }
  }
  if (typeof body.password !== 'string' || body.password.length < 8) {
    details.push({ field: 'password', message: 'Use pelo menos 8 caracteres.' })
  }
  if (!['adopter', 'guardian'].includes(String(body.accountType))) {
    details.push({ field: 'accountType', message: 'Escolha o tipo da conta.' })
  }
  if (details.length) return sendError(res, 400, 'Validação falhou', details)

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...normalized,
      role: guardian ? 'RESPONSAVEL' : 'ADOTANTE',
      roles: [guardian ? 'GUARDIAN' : 'ADOPTER'],
    },
  })
  res.json(publicUser(user))
})

profileRouter.get('/me/adopter-profile', async (req, res) => {
  const { id } = await currentUser(req)
  res.json(await getProfile(id))
})

profileRouter.put('/me/adopter-profile', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const body = asRecord(req.body)
  if (!body) {
    return sendError(res, 400, 'Corpo da requisição inválido', [
      { field: 'body', message: 'Envie um objeto JSON' },
    ])
  }

  const details: FieldError[] = []
  const patch: Partial<Record<ProfileField, string | boolean>> = {}
  for (const key of PROFILE_FIELDS) {
    if (body[key] === undefined) continue
    // String vazia limpa o campo (o formulário usa '' para "não preenchido").
    if (body[key] === '' && !isBooleanField(key)) {
      Object.assign(patch, { [key]: '' })
      continue
    }
    const message = profileFieldError(key, body[key])
    if (message) {
      details.push({ field: key, message })
      continue
    }
    Object.assign(patch, {
      [key]: PROFILE_DIGITS.includes(key) ? digitsOnly(body[key] as string) : body[key],
    })
  }
  if (details.length) return sendError(res, 400, 'Validação falhou', details)

  const createData: Prisma.AdopterProfileUncheckedCreateInput = { userId }
  const updateData: Prisma.AdopterProfileUncheckedUpdateInput = {}
  Object.assign(createData, patch)
  Object.assign(updateData, patch)
  await prisma.adopterProfile.upsert({
    where: { userId },
    create: createData,
    update: updateData,
  })
  res.json(await getProfile(userId))
})

profileRouter.get('/me/guardian-profile', async (req, res) => {
  const { id } = await currentUser(req)
  res.json(await getGuardianProfile(id))
})

profileRouter.put('/me/guardian-profile', async (req, res) => {
  const { id: userId } = await currentUser(req)
  const body = asRecord(req.body)
  if (!body) {
    return sendError(res, 400, 'Corpo da requisição inválido', [
      { field: 'body', message: 'Envie um objeto JSON' },
    ])
  }

  const existing = await prisma.guardianProfile.findUnique({ where: { userId } })
  const next: Record<string, unknown> = { ...(existing ?? {}), ...body, userId }
  const details: FieldError[] = []
  const patch: Partial<Record<GuardianField, string | boolean>> = {}
  for (const key of GUARDIAN_FIELDS) {
    if (body[key] === undefined) continue
    if (body[key] === '' && key !== 'acceptsTerms') {
      Object.assign(patch, { [key]: '' })
      continue
    }
    const message = guardianFieldError(key, body[key], next)
    if (message) details.push({ field: key, message })
    else
      Object.assign(patch, {
        [key]: GUARDIAN_DIGITS.includes(key) ? digitsOnly(body[key] as string) : body[key],
      })
  }
  if (details.length) return sendError(res, 400, 'Validação falhou', details)

  const createData: Prisma.GuardianProfileUncheckedCreateInput = { userId }
  const updateData: Prisma.GuardianProfileUncheckedUpdateInput = {}
  Object.assign(createData, patch)
  Object.assign(updateData, patch)
  await prisma.guardianProfile.upsert({ where: { userId }, create: createData, update: updateData })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const roles = Array.from(new Set([...(user?.roles ?? ['ADOPTER']), 'GUARDIAN']))
  await prisma.user.update({ where: { id: userId }, data: { roles } })
  res.json(await getGuardianProfile(userId))
})
