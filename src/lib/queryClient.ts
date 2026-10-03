import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './ApiError'

const MAX_RETRIES = 2
const STALE_TIME_MS = 60_000

/** Não repete erros 4xx; repete até 2 vezes erros de rede e 5xx. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.isClientError) return false
  return failureCount < MAX_RETRIES
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, staleTime: STALE_TIME_MS },
  },
})
