export type ApiErrorDetails = unknown

interface ErrorBody {
  statusCode?: number
  message?: string | string[]
  details?: ApiErrorDetails
}

const NETWORK_ERROR_STATUS = 0

/**
 * Erro padrão da API: `{ statusCode, message, details }`.
 * `statusCode` 0 representa falha de rede (sem resposta do servidor).
 */
export class ApiError extends Error {
  readonly statusCode: number
  readonly details?: ApiErrorDetails
  cause?: unknown

  constructor(statusCode: number, message: string, details?: ApiErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.details = details
  }

  static network(cause?: unknown): ApiError {
    const error = new ApiError(
      NETWORK_ERROR_STATUS,
      'Não foi possível conectar ao servidor. Verifique sua conexão.',
    )
    error.cause = cause
    return error
  }

  /** Converte uma resposta HTTP não-ok em ApiError, tolerando corpos fora do padrão. */
  static async fromResponse(response: Response): Promise<ApiError> {
    let body: ErrorBody | undefined
    try {
      body = (await response.json()) as ErrorBody
    } catch {
      body = undefined
    }
    const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message
    return new ApiError(
      body?.statusCode ?? response.status,
      message || response.statusText || 'Erro inesperado.',
      body?.details,
    )
  }

  get isNetworkError(): boolean {
    return this.statusCode === NETWORK_ERROR_STATUS
  }

  get isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * Mapeia `details` para erros por campo (`{ campo: mensagem }`), no formato aceito por
   * `setError` do React Hook Form. Aceita `[{ field | path, message }]` ou `{ campo: mensagem }`.
   */
  toFieldErrors(): Record<string, string> {
    const result: Record<string, string> = {}
    const { details } = this
    if (Array.isArray(details)) {
      for (const item of details) {
        if (!item || typeof item !== 'object') continue
        const { field, path, message } = item as {
          field?: unknown
          path?: unknown
          message?: unknown
        }
        const name = Array.isArray(path) ? path.join('.') : (field ?? path)
        if (typeof name === 'string' && typeof message === 'string' && !(name in result)) {
          result[name] = message
        }
      }
    } else if (details && typeof details === 'object') {
      for (const [name, value] of Object.entries(details)) {
        const message = Array.isArray(value) ? value[0] : value
        if (typeof message === 'string') result[name] = message
      }
    }
    return result
  }
}
