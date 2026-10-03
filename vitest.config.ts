import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './__tests__/setup.ts',
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    // Integration tests hit a real database and need seeded anchor data — they run
    // via `npm run test:integration` (vitest.integration.config.ts), not the default gate.
    exclude: ['node_modules', '.next', 'SYSTEM ADMIN PANEL', '**/*.integration.test.ts', '__tests__/integration/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
