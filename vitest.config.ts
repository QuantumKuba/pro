/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    transformMode: {
      web: [/\.[jt]sx?$/]
    }
  },
  resolve: {
    conditions: ['development', 'browser']
  }
})
