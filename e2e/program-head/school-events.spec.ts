import { test, expect } from '@playwright/test'

test.describe('Program Head School Events', () => {
  test('should load the school events page', async ({ page }) => {
    await page.goto('/program/school-events')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/school-events/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should display events or empty state', async ({ page }) => {
    await page.goto('/program/school-events')
    await page.waitForLoadState('networkidle')

    const hasEvents = await page.locator('table, [class*="card"], [class*="event"]').count()
    const hasEmptyState = await page.getByText(/no events|empty|no school events/i).count()

    expect(hasEvents > 0 || hasEmptyState > 0).toBe(true)
  })
})
