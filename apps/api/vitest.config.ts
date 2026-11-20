import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    // Os testes compartilham um único database de teste.
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
})
