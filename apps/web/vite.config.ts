/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Por padrão o Vite aponta para o backend real (3002). `npm run dev:mock`
// define VITE_API_PROXY_TARGET=3001 para usar o mock-server sem mudar o .env.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3002'
const proxy = { '/api': apiTarget }

// O Vite recusa (403) pedidos cujo Host não seja localhost. No GitHub Codespaces o
// navegador acessa por https://<nome>-<porta>.app.github.dev, então esse domínio precisa
// estar liberado. O ponto inicial libera todos os subdomínios.
const allowedHosts = ['.app.github.dev']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O backend aceita o prefixo /api, então não é preciso reescrever o caminho.
  server: { proxy, allowedHosts },
  preview: { proxy, allowedHosts },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Só os testes do frontend e do mock: os do backend (workspace) rodam com o
    // Vitest próprio do backend, em ambiente node.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'mock-server/**/*.test.js', 'vite.config.test.js'],
  },
})
