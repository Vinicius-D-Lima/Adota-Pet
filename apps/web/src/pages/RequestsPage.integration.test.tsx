import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { RequestsPage } from './RequestsPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Cobre o caminho real: fetch -> api -> Zod -> React Query -> tela. */
it('lista vazia devolvida pela API mostra o estado vazio', async () => {
  const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ data: [], total: 0 })))
  vi.stubGlobal('fetch', fetchMock)

  renderWithProviders(<RequestsPage />)

  expect(await screen.findByText(/nenhuma solicitação ainda/i)).toBeInTheDocument()
  expect(screen.queryByText(/algo deu errado/i)).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/me/requests'),
    expect.objectContaining({ credentials: 'include' }),
  )
})
