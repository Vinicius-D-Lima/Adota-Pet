/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_DEMO_USER_ID?: string
  readonly VITE_DEMO_SESSION_ID?: string
  readonly VITE_DEMO_ROLE?: 'ADMIN' | 'VOLUNTEER'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Definido pelo Vite: `real` com o backend na 3002, `demo` no mock/testes. */
declare const __AUTH_MODE__: 'real' | 'demo'
