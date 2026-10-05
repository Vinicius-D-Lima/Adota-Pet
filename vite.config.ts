/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = { '/api': 'http://localhost:3001' }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O mock-server aceita o prefixo /api, então não é preciso reescrever o caminho.
  server: { proxy },
  preview: { proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
