import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import S3rver from 's3rver'

/**
 * S3 compatível em processo para os testes STO (#94). Substitui o SeaweedFS do
 * compose (que o projeto não usa); a API fala a mesma API S3, então a troca por
 * outro provedor continua sendo só configuração.
 */
export interface TestStorage {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  client: S3Client
  close(): Promise<void>
}

export async function startTestStorage(bucket = 'adotapet-test'): Promise<TestStorage> {
  const directory = await mkdtemp(join(tmpdir(), 'adotapet-storage-'))
  const server = new S3rver({ address: '127.0.0.1', port: 0, silent: true, directory })
  await server.run()
  // `@types/s3rver` não expõe o servidor HTTP interno; precisamos da porta
  // escolhida pelo SO ao escutar em 0.
  const httpServer = (server as unknown as { httpServer: { address(): { port: number } | null } })
    .httpServer
  const port = httpServer.address()?.port ?? 4569
  const endpoint = `http://127.0.0.1:${port}`
  const accessKeyId = 'S3RVER'
  const secretAccessKey = 'S3RVER'
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
  await client.send(new CreateBucketCommand({ Bucket: bucket }))

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    client,
    async close() {
      client.destroy()
      await server.close()
      await rm(directory, { recursive: true, force: true })
    },
  }
}
