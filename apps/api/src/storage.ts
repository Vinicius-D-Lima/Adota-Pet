import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { fileTypeFromBuffer } from 'file-type'
import { SignJWT, jwtVerify } from 'jose'
import type { Logger } from 'pino'
import type { ApiConfig } from './config.js'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import { HttpError, type FieldError } from './http.js'
import { logger as defaultLogger } from './logger.js'

/**
 * Módulo único de armazenamento (#94).
 *
 * O código fala apenas com `StorageProvider`. A implementação S3 atende tanto
 * SeaweedFS quanto R2/S3: endpoint, bucket, região e credenciais são env vars.
 * Nenhum arquivo é público — a leitura passa por uma URL assinada pela API,
 * que também aplica `nosniff` e o `Content-Type` detectado no upload.
 */

export interface StorageConfig {
  endpoint?: string
  region: string
  bucket: string
  accessKeyId?: string
  secretAccessKey?: string
  forcePathStyle: boolean
  signedUrlTtlSeconds: number
  signingSecret: string
}

export function storageConfigFromConfig(config: ApiConfig): StorageConfig {
  return {
    endpoint: config.STORAGE_ENDPOINT,
    region: config.STORAGE_REGION,
    bucket: config.STORAGE_BUCKET,
    accessKeyId: config.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
    signedUrlTtlSeconds: config.STORAGE_SIGNED_URL_TTL_SECONDS,
    signingSecret: config.STORAGE_URL_SECRET ?? config.JWT_SECRET,
  }
}

/** Configurado = endpoint explícito (S3 compatível) ou credenciais AWS. */
export function isStorageConfigured(config: ApiConfig = loadConfig()): boolean {
  return Boolean(
    config.STORAGE_ENDPOINT || (config.STORAGE_ACCESS_KEY_ID && config.STORAGE_SECRET_ACCESS_KEY),
  )
}

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageConfigurationError'
  }
}

export interface StoredObject {
  key: string
  contentType: string
  sizeBytes: number
}

export interface StorageProvider {
  readonly bucket: string
  ensureBucket(): Promise<void>
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<StoredObject>
  getObject(key: string): Promise<{ body: Buffer; contentType: string; sizeBytes: number }>
  deleteObject(key: string): Promise<void>
  objectExists(key: string): Promise<boolean>
  /** URL S3 assinada (presigner da AWS) — usada em integração/verificação. */
  presignGet(key: string, expiresInSeconds: number): Promise<string>
}

export class S3StorageProvider implements StorageProvider {
  readonly bucket: string
  private readonly client: S3Client

  constructor(config: StorageConfig) {
    if (config.endpoint && (!config.accessKeyId || !config.secretAccessKey)) {
      throw new StorageConfigurationError(
        'STORAGE_ACCESS_KEY_ID e STORAGE_SECRET_ACCESS_KEY são obrigatórios com STORAGE_ENDPOINT',
      )
    }
    this.bucket = config.bucket
    const options: ConstructorParameters<typeof S3Client>[0] = {
      region: config.region,
      forcePathStyle: config.forcePathStyle,
    }
    if (config.endpoint) options.endpoint = config.endpoint
    if (config.accessKeyId && config.secretAccessKey) {
      options.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      }
    }
    this.client = new S3Client(options)
  }

  /** Cria o bucket se não existir; idempotente por design. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
    } catch (error) {
      const name = (error as { name?: string }).name
      if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw error
    }
  }

  async putObject({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
    return { key, contentType, sizeBytes: body.byteLength }
  }

  async getObject(key: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!response.Body) throw new Error(`Objeto ${key} sem corpo`)
    const body = Buffer.from(await response.Body.transformToByteArray())
    return {
      body,
      contentType: response.ContentType ?? 'application/octet-stream',
      sizeBytes: body.byteLength,
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }

  presignGet(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    })
  }
}

let cachedProvider: StorageProvider | null = null

/** Provedor único por processo, construído na primeira uso (sem I/O no import). */
export function getStorageProvider(config: ApiConfig = loadConfig()): StorageProvider {
  if (!cachedProvider) cachedProvider = new S3StorageProvider(storageConfigFromConfig(config))
  return cachedProvider
}

/** Injeção usada nos testes e em futuros testes de outro provedor. */
export function setStorageProvider(provider: StorageProvider | null): void {
  cachedProvider = provider
}

// ---------------------------------------------------------------------------
// Validação de upload (#94 / STO-04, STO-05)
// ---------------------------------------------------------------------------

/** Escopos prontos para os módulos que virão (#24, #26, #29, #49). */
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export interface UploadLimits {
  prefix: string
  allowedMimeTypes: readonly string[]
  maxFiles: number
  maxBytesPerFile: number
}

export const STORAGE_SCOPES = {
  petPhoto: {
    prefix: 'pets',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxFiles: 8,
    maxBytesPerFile: 5 * 1024 * 1024,
  },
  checkInPhoto: {
    prefix: 'check-ins',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxFiles: 5,
    maxBytesPerFile: 5 * 1024 * 1024,
  },
  reportAttachment: {
    prefix: 'reports',
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxFiles: 5,
    maxBytesPerFile: 5 * 1024 * 1024,
  },
  medicalExam: {
    prefix: 'medical-exams',
    allowedMimeTypes: [...IMAGE_MIME_TYPES, 'application/pdf'],
    maxFiles: 5,
    maxBytesPerFile: 10 * 1024 * 1024,
  },
} as const satisfies Record<string, UploadLimits>

export type StorageScopeName = keyof typeof STORAGE_SCOPES

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/**
 * Nome do objeto gerado integralmente no servidor: prefixo sanitizado + UUID +
 * extensão do MIME detectado. O filename do cliente nunca entra na chave,
 * então `../` não escapa do prefixo (STO-05).
 */
export function buildObjectKey(prefix: string, contentType: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'files'
  const extension = MIME_EXTENSIONS[contentType] ?? 'bin'
  return `${safePrefix}/${randomUUID()}.${extension}`
}

/** Tipo vem da assinatura do arquivo, nunca da extensão ou do header enviado. */
export async function detectContentType(buffer: Buffer): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer)
  return detected?.mime ?? null
}

export interface PreparedFile {
  key: string
  body: Buffer
  contentType: string
}

export async function validateUploadFiles(
  files: Express.Multer.File[],
  limits: UploadLimits,
): Promise<PreparedFile[]> {
  const details: FieldError[] = []
  if (files.length === 0) {
    throw new HttpError(400, 'Envie ao menos um arquivo', [
      { field: 'files', message: 'Nenhum arquivo recebido' },
    ])
  }
  if (files.length > limits.maxFiles) {
    details.push({
      field: 'files',
      message: `Máximo de ${limits.maxFiles} arquivos por operação`,
    })
  }

  const prepared: PreparedFile[] = []
  for (const file of files) {
    if (file.size > limits.maxBytesPerFile) {
      details.push({
        field: `files[${file.originalname}]`,
        message: `Cada arquivo deve ter no máximo ${limits.maxBytesPerFile} bytes`,
      })
      continue
    }
    const contentType = await detectContentType(file.buffer)
    if (!contentType || !limits.allowedMimeTypes.includes(contentType)) {
      details.push({
        field: `files[${file.originalname}]`,
        message: 'Tipo de arquivo não permitido para este recurso',
      })
      continue
    }
    prepared.push({
      key: buildObjectKey(limits.prefix, contentType),
      body: file.buffer,
      contentType,
    })
  }

  if (details.length) throw new HttpError(400, 'Upload inválido', details)
  return prepared
}

// ---------------------------------------------------------------------------
// URLs assinadas da API (STO-02, STO-03, STO-06)
// ---------------------------------------------------------------------------

export interface SignedUrl {
  url: string
  expiresAt: string
}

/**
 * A URL entregue ao cliente aponta para a API, não para o bucket. Assim o
 * bucket continua privado, o 403 de ausência/expiração é previsível em qualquer
 * provedor e a resposta sai com `nosniff` (STO-09).
 */
export async function signObjectUrl(
  objectId: string,
  expiresInSeconds: number,
  secret: string,
): Promise<SignedUrl> {
  const token = await new SignJWT({ oid: objectId, purpose: 'storage-read' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(new TextEncoder().encode(secret))
  return {
    url: `/files/${encodeURIComponent(objectId)}?token=${encodeURIComponent(token)}`,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  }
}

export async function verifyObjectToken(
  token: string,
  objectId: string,
  secret: string,
): Promise<void> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    if (payload.purpose !== 'storage-read' || payload.oid !== objectId) {
      throw new Error('token de outro objeto')
    }
  } catch {
    throw new HttpError(403, 'URL de acesso inválida ou expirada')
  }
}

// ---------------------------------------------------------------------------
// Limpeza de órfãos (STO-08)
// ---------------------------------------------------------------------------

/**
 * Remove do provedor todos os objetos ligados a um registro e depois apaga os
 * metadados. Chamado pela exclusão do pet hoje; os módulos #24/#26/#29 devem
 * chamar o mesmo helper ao apagar check-in, denúncia ou prontuário.
 */
export async function deleteStorageObjectsForResource(
  resourceType: string,
  resourceId: string,
  appLogger: Logger = defaultLogger,
): Promise<void> {
  const objects = await prisma.storageObject.findMany({
    where: { resourceType, resourceId },
    select: { key: true },
  })
  if (objects.length === 0) return

  const provider = getStorageProvider()
  await Promise.all(
    objects.map(async ({ key }) => {
      try {
        await provider.deleteObject(key)
      } catch (error) {
        appLogger.warn({ err: error, key }, 'falha ao remover objeto de armazenamento')
      }
    }),
  )
  await prisma.storageObject.deleteMany({ where: { resourceType, resourceId } })
}
