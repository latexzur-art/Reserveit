import { test, expect } from '@playwright/test'

test.describe('Faculty Calendar', () => {
  test('should load the calendar page', async ({ page }) => {
    await page.goto('/faculty/calendar')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/faculty\/calendar/)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

test.describe('Faculty Notifications', () => {
  test('should load the notifications page', async ({ page }) => {
    await page.goto('/faculty/notifications')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/faculty\/notifications/)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})
