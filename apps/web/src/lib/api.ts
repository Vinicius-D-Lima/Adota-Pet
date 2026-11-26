import { ApiError } from './ApiError'
import { getDemoAccountId, getDemoRole } from './demoAccount'
import { clearSession, getAccessToken, isRealAuth, setSession, type AuthTokens } from './session'

type QueryValue = string | number | boolean | undefined | null

/** Listas viram parâmetro repetido: `size=Pequeno&size=Médio`. */
type Query = Record<string, QueryValue | QueryValue[]>

interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  /** Objeto/array serializado como JSON, ou FormData enviado como multipart. */
  body?: unknown
  query?: Query
  /** Usado pelas próprias rotas /auth para não recursar o refresh em 401. */
  skipAuthRefresh?: boolean
  /** Percentual de 0 a 100 durante uploads multipart (#37). */
  onUploadProgress?: (percent: number) => void
}

const DEFAULT_BASE_URL = '/api'

function getBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

export function buildUrl(path: string, query?: Query): string {
  const url = `${getBaseUrl()}/${path.replace(/^\/+/, '')}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) params.append(key, String(item))
    }
  }
  const search = params.toString()
  return search ? `${url}?${search}` : url
}

/** URLs assinadas voltam relativas à API (`/files/...`); HTTP(S) passa direto. */
export function resolveApiUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : buildUrl(path)
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('Accept', 'application/json')
  if (isRealAuth()) {
    const token = getAccessToken()
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  } else {
    // O mock não entende JWT: ele ainda identifica o usuário por estes headers.
    headers.set('X-Demo-User-Id', getDemoAccountId())
    headers.set('X-Demo-Role', getDemoRole())
  }
  return headers
}

/** Uma única renovação em voo evita N refreshes quando N queries dão 401 juntas. */
let inFlightRefresh: Promise<AuthTokens> | undefined

export function refreshSession(): Promise<AuthTokens> {
  if (inFlightRefresh) return inFlightRefresh
  inFlightRefresh = (async () => {
    const response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw await ApiError.fromResponse(response)
    const data = (await response.json()) as AuthTokens
    setSession(data)
    return data
  })().finally(() => {
    inFlightRefresh = undefined
  })
  return inFlightRefresh
}

function apiErrorFromXhr(xhr: XMLHttpRequest): ApiError {
  let body: { statusCode?: number; message?: string | string[]; details?: unknown } | undefined
  try {
    body = JSON.parse(xhr.responseText) as typeof body
  } catch {
    body = undefined
  }
  const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message
  return new ApiError(
    body?.statusCode ?? xhr.status,
    message || xhr.statusText || 'Erro inesperado.',
    body?.details,
  )
}

/** `fetch` não expõe progresso de upload; XHR é usado só quando o chamador pede. */
function uploadWithProgress<T>(
  method: string,
  url: string,
  headers: Headers,
  body: FormData,
  onProgress: (percent: number) => void,
  signal?: AbortSignal | null,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url, true)
    headers.forEach((value, key) => xhr.setRequestHeader(key, value))
    xhr.withCredentials = true
    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        reject(new DOMException('Requisição abortada', 'AbortError'))
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        const text = xhr.responseText
        if (!text) {
          resolve(undefined as T)
          return
        }
        try {
          resolve(JSON.parse(text) as T)
        } catch {
          reject(new ApiError(xhr.status, 'Resposta inválida do servidor.'))
        }
        return
      }
      reject(apiErrorFromXhr(xhr))
    }
    xhr.onerror = () => reject(ApiError.network())
    xhr.onabort = () => reject(new DOMException('Requisição abortada', 'AbortError'))
    xhr.send(body)
  })
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const {
    body,
    query,
    headers: extraHeaders,
    skipAuthRefresh = false,
    onUploadProgress,
    ...init
  } = options

  let payload: BodyInit | undefined
  const headers = buildHeaders(extraHeaders)
  if (body instanceof FormData) {
    // O browser define o Content-Type multipart com o boundary correto.
    payload = body
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }

  const url = buildUrl(path, query)
  const doFetch = (requestHeaders: Headers) =>
    fetch(url, { ...init, method, headers: requestHeaders, body: payload, credentials: 'include' })

  if (onUploadProgress && payload instanceof FormData) {
    const upload = (requestHeaders: Headers) =>
      uploadWithProgress<T>(method, url, requestHeaders, payload, onUploadProgress, init.signal)
    const canRefresh = isRealAuth() && !skipAuthRefresh && !path.includes('/auth/')
    try {
      return await upload(headers)
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401 || !canRefresh) throw error
      try {
        await refreshSession()
        return await upload(buildHeaders(extraHeaders))
      } catch {
        clearSession()
        throw error
      }
    }
  }

  let response: Response
  try {
    response = await doFetch(headers)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw ApiError.network(error)
  }

  const canRefresh = isRealAuth() && !skipAuthRefresh && !path.includes('/auth/')
  if (response.status === 401 && canRefresh) {
    try {
      await refreshSession()
      response = await doFetch(buildHeaders(extraHeaders))
    } catch {
      clearSession()
    }
  }

  if (!response.ok) throw await ApiError.fromResponse(response)
  if (response.status === 204) return undefined as T

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
}
