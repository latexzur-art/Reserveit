import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Integration test config — runs the *.integration.test.ts suites that hit a REAL
 * Supabase database. These require seeded anchor data (department/term/user) and
 * real credentials in .env.local. Run explicitly with `npm run test:integration`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './__tests__/setup.ts',
    include: ['__tests__/**/*.integration.test.{ts,tsx}', '__tests__/integration/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'SYSTEM ADMIN PANEL'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
