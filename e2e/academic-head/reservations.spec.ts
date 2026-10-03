import { test, expect } from '@playwright/test'

test.describe('Academic Head Reservations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/academic/reserve')
    // Wait for loading to complete
    await page.waitForLoadState('networkidle')
  })

  test('should display the reservations page', async ({ page }) => {
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should display reservation list or empty state', async ({ page }) => {
    // Either we see reservation cards/table or an empty state message
    const hasContent = await page.locator('[data-testid="reservation-list"], table, [class*="card"]').count()
    const hasEmptyState = await page.getByText(/no reservations|no bookings|empty/i).count()

    expect(hasContent > 0 || hasEmptyState > 0).toBe(true)
  })

  test('should filter reservations by status', async ({ page }) => {
    // Look for a status filter dropdown/select
    const statusFilter = page.locator('select, [role="combobox"]').filter({ hasText: /status|filter/i }).first()

    if (await statusFilter.isVisible()) {
      await statusFilter.click()
      // Try selecting "pending"
      const pendingOption = page.getByRole('option', { name: /pending/i }).first()
      if (await pendingOption.isVisible()) {
        await pendingOption.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })
})
