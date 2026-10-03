import { test, expect } from '@playwright/test'

test.describe('Faculty Navigation', () => {
  test('should load the dashboard', async ({ page }) => {
    await page.goto('/faculty/dashboard')
    await expect(page).toHaveURL(/faculty\/dashboard/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should navigate to new reservation form', async ({ page }) => {
    await page.goto('/faculty/dashboard')
    const link = page.getByRole('link', { name: /new reservation/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/faculty\/form/)
    }
  })

  test('should navigate to my reservations', async ({ page }) => {
    await page.goto('/faculty/dashboard')
    const link = page.getByRole('link', { name: /my reservations/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/faculty\/reservations/)
    }
  })

  test('should navigate to calendar', async ({ page }) => {
    await page.goto('/faculty/dashboard')
    const link = page.getByRole('link', { name: /calendar/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/faculty\/calendar/)
    }
  })

  test('should navigate to notifications', async ({ page }) => {
    await page.goto('/faculty/dashboard')
    const link = page.getByRole('link', { name: /notifications/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/faculty\/notifications/)
    }
  })

  test('should navigate to profile', async ({ page }) => {
    await page.goto('/faculty/dashboard')
    const link = page.getByRole('link', { name: /profile/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/faculty\/profile/)
    }
  })
})
