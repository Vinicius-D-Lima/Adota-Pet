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
