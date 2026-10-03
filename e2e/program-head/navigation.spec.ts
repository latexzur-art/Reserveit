import { test, expect } from '@playwright/test'

test.describe('Program Head Navigation', () => {
  test('should load the dashboard', async ({ page }) => {
    await page.goto('/program/dashboard')
    await expect(page).toHaveURL(/programhead\/dashboard/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should navigate to new reservation form', async ({ page }) => {
    await page.goto('/program/dashboard')
    const formLink = page.getByRole('link', { name: /new reservation/i }).first()
    if (await formLink.isVisible()) {
      await formLink.click()
      await expect(page).toHaveURL(/programhead\/form/)
    }
  })

  test('should navigate to my reservations', async ({ page }) => {
    await page.goto('/program/dashboard')
    const link = page.getByRole('link', { name: /my reservations/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/programhead\/reservations/)
    }
  })

  test('should navigate to calendar', async ({ page }) => {
    await page.goto('/program/dashboard')
    const link = page.getByRole('link', { name: /calendar/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/programhead\/calendar/)
    }
  })

  test('should navigate to notifications', async ({ page }) => {
    await page.goto('/program/dashboard')
    const link = page.getByRole('link', { name: /notifications/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/programhead\/notifications/)
    }
  })

  test('should navigate to schedule management', async ({ page }) => {
    await page.goto('/program/dashboard')
    const link = page.getByRole('link', { name: /schedule management/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/programhead\/schedule-management/)
    }
  })

  test('should navigate to approved schedules', async ({ page }) => {
    await page.goto('/program/dashboard')
    const link = page.getByRole('link', { name: /approved schedules/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/programhead\/approved-schedules/)
    }
  })

  test('should navigate to school events', async ({ page }) => {
    await page.goto('/program/dashboard')
    const link = page.getByRole('link', { name: /school events/i }).first()
    if (await link.isVisible()) {
      await link.click()
      await expect(page).toHaveURL(/programhead\/school-events/)
    }
  })
})
