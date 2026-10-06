/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = { '/api': 'http://localhost:3001' }

// O Vite recusa (403) pedidos cujo Host não seja localhost. No GitHub Codespaces o
// navegador acessa por https://<nome>-<porta>.app.github.dev, então esse domínio precisa
// estar liberado. O ponto inicial libera todos os subdomínios.
const allowedHosts = ['.app.github.dev']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O mock-server aceita o prefixo /api, então não é preciso reescrever o caminho.
  server: { proxy, allowedHosts },
  preview: { proxy, allowedHosts },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
