import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'academic-head',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/academic-head.json',
      },
      testDir: './e2e/academic-head',
      dependencies: ['setup'],
    },
    {
      name: 'program-head',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/program-head.json',
      },
      testDir: './e2e/program-head',
      dependencies: ['setup'],
    },
    {
      name: 'faculty',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/faculty.json',
      },
      testDir: './e2e/faculty',
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
