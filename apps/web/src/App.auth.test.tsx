import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './components/AuthProvider'
import { ProtectedRoute } from './App'
import { isRealAuth } from './lib/session'
import { clearSession, setLoading } from './lib/session'

vi.mock('./lib/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('./lib/session')>()
  return { ...original, isRealAuth: () => true }
})

const mocks = vi.hoisted(() => ({ restoreSession: vi.fn() }))

vi.mock('./lib/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  restoreSession: mocks.restoreSession,
}))

function CurrentPath() {
  const location = useLocation()
  return <output data-testid="path">{location.pathname}</output>
}

describe('guards de sessão', () => {
  beforeEach(() => {
    clearSession()
    setLoading()
  })

  it('mostra o estado de carregamento e só redireciona depois da restauração', async () => {
    // Nunca resolve: mantém o app em `loading` até o teste forçar `clearSession()`.
    mocks.restoreSession.mockImplementation(() => new Promise(() => {}))

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <div>Conteúdo privado</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/entrar" element={<div>Login</div>} />
            </Routes>
            <CurrentPath />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText(/verificando sua sessão/i)).toBeInTheDocument()
    expect(screen.queryByText('Login')).not.toBeInTheDocument()

    expect(isRealAuth()).toBe(true)
    clearSession()
    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/entrar')
    })
    expect(screen.getByText('Login')).toBeInTheDocument()
  })
})
