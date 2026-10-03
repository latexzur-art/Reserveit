import { test as setup, expect } from '@playwright/test'

/**
 * Authentication setup for E2E tests.
 * Logs in as an academic head user and saves the session state.
 *
 * IMPORTANT: Before running E2E tests, ensure:
 * 1. The app is running (npm run dev)
 * 2. A test academic head user exists in Supabase
 * 3. Update the credentials below to match your test user
 */

const ACADEMIC_HEAD_EMAIL = process.env.E2E_ACADEMIC_HEAD_EMAIL || 'academic.head@test.com'
const ACADEMIC_HEAD_PASSWORD = process.env.E2E_ACADEMIC_HEAD_PASSWORD || 'TestPassword123!'

const PROGRAM_HEAD_EMAIL = process.env.E2E_PROGRAM_HEAD_EMAIL || 'program.head@test.com'
const PROGRAM_HEAD_PASSWORD = process.env.E2E_PROGRAM_HEAD_PASSWORD || 'TestPassword123!'

const FACULTY_EMAIL = process.env.E2E_FACULTY_EMAIL || 'faculty@test.com'
const FACULTY_PASSWORD = process.env.E2E_FACULTY_PASSWORD || 'TestPassword123!'

setup('authenticate as academic head', async ({ page }) => {
  await page.goto('/client/login')
  await page.locator('input[type="email"]').fill(ACADEMIC_HEAD_EMAIL)
  await page.locator('input[type="password"]').fill(ACADEMIC_HEAD_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL('**/academic/dashboard', { timeout: 15000 })
  await expect(page).toHaveURL(/academic/)
  await page.context().storageState({ path: 'e2e/.auth/academic-head.json' })
})

setup('authenticate as program head', async ({ page }) => {
  await page.goto('/client/login')
  await page.locator('input[type="email"]').fill(PROGRAM_HEAD_EMAIL)
  await page.locator('input[type="password"]').fill(PROGRAM_HEAD_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL('**/program/dashboard', { timeout: 15000 })
  await expect(page).toHaveURL(/program/)
  await page.context().storageState({ path: 'e2e/.auth/program-head.json' })
})

setup('authenticate as faculty', async ({ page }) => {
  await page.goto('/client/login')
  await page.locator('input[type="email"]').fill(FACULTY_EMAIL)
  await page.locator('input[type="password"]').fill(FACULTY_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  await page.waitForURL('**/faculty/dashboard', { timeout: 15000 })
  await expect(page).toHaveURL(/faculty/)
  await page.context().storageState({ path: 'e2e/.auth/faculty.json' })
})
