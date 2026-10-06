import { ApiError } from './ApiError'
import { getDemoAccountId } from './demoAccount'

type QueryValue = string | number | boolean | undefined | null

/** Listas viram parâmetro repetido: `size=Pequeno&size=Médio`. */
type Query = Record<string, QueryValue | QueryValue[]>

interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  /** Objeto/array serializado como JSON, ou FormData enviado como multipart. */
  body?: unknown
  query?: Query
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

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers: extraHeaders, ...init } = options
  const headers = new Headers(extraHeaders)
  headers.set('Accept', 'application/json')
  headers.set('X-Demo-User-Id', getDemoAccountId())

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    // O browser define o Content-Type multipart com o boundary correto.
    payload = body
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), { ...init, method, headers, body: payload })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw ApiError.network(error)
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
