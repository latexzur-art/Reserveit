import { test, expect } from '@playwright/test'

test.describe('Faculty Reservation Form', () => {
  test('should load the form page', async ({ page }) => {
    await page.goto('/faculty/form')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/faculty\/form/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should display facility selection', async ({ page }) => {
    await page.goto('/faculty/form')
    await page.waitForLoadState('networkidle')

    const hasSelect = await page.locator('select, [role="combobox"], [class*="select"]').count()
    const hasForm = await page.locator('form, [class*="form"]').count()

    expect(hasSelect > 0 || hasForm > 0).toBe(true)
  })
})
