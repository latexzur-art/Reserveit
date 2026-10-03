import { test, expect } from '@playwright/test'

test.describe('Program Head Reservations', () => {
  test('should load the reservations page', async ({ page }) => {
    await page.goto('/program/reservations')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/programhead\/reservations/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should display reservations or empty state', async ({ page }) => {
    await page.goto('/program/reservations')
    await page.waitForLoadState('networkidle')

    const hasContent = await page.locator('table, [class*="card"]').count()
    const hasEmptyState = await page.getByText(/no reservations|no bookings|empty/i).count()

    expect(hasContent > 0 || hasEmptyState > 0).toBe(true)
  })
})
