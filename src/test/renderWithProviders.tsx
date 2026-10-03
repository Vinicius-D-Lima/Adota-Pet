import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
}

/** Renderiza com QueryClient isolado (sem retry) e MemoryRouter. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...options }: ProvidersOptions = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
      options,
    ),
  }
}
