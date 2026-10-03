/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxy = { "/api": "http://localhost:3001" };

export default defineConfig({
  plugins: [react()],
  // O mock-server aceita o prefixo /api, então não é preciso reescrever o caminho.
  server: { proxy },
  preview: { proxy },
  test: { environment: "node" },
});
