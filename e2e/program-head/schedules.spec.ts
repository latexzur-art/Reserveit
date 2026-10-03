import { test, expect } from '@playwright/test'

test.describe('Program Head Schedule Management', () => {
  test('should load schedule management page', async ({ page }) => {
    await page.goto('/program/schedule-management')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedule-management/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should load approved schedules page', async ({ page }) => {
    await page.goto('/program/approved-schedules')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/approved-schedules/)
  })

  test('should load schedule uploads page', async ({ page }) => {
    await page.goto('/program/schedules/uploads')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/schedules\/uploads/)
  })
})
