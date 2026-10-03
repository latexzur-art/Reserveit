import { test, expect } from '@playwright/test'

test.describe('Academic Head Schedule Management', () => {
  test('should load schedule uploads page', async ({ page }) => {
    await page.goto('/academic/schedules/uploads')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/uploads/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should load schedule history page', async ({ page }) => {
    await page.goto('/academic/schedules/history')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/history/)
  })

  test('should load calendar page', async ({ page }) => {
    await page.goto('/academic/schedules/calendar')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/calendar/)
  })

  test('should load events page', async ({ page }) => {
    await page.goto('/academic/schedules/events')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/events/)
  })

  test('should load terms page', async ({ page }) => {
    await page.goto('/academic/schedules/terms')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/terms/)
  })

  test('should load enrollment page', async ({ page }) => {
    await page.goto('/academic/schedules/enrollment')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/enrollment/)
  })

  test('should load change requests page', async ({ page }) => {
    await page.goto('/academic/schedules/change-requests')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/change-requests/)
  })

  test('should load aliases page', async ({ page }) => {
    await page.goto('/academic/schedules/aliases')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/aliases/)
  })
})
