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

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers: extraHeaders, skipAuthRefresh = false, ...init } = options

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
