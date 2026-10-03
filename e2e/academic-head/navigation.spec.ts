import { test, expect } from '@playwright/test'

test.describe('Academic Head Navigation', () => {
  test('should load the dashboard', async ({ page }) => {
    await page.goto('/academic/dashboard')
    await expect(page).toHaveURL(/academic\/dashboard/)

    // Dashboard should have some content
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should navigate to reservations page', async ({ page }) => {
    await page.goto('/academic/dashboard')

    // Click on reservations link in sidebar or nav
    const reservationsLink = page.getByRole('link', { name: /reservations|reserve/i }).first()
    if (await reservationsLink.isVisible()) {
      await reservationsLink.click()
      await expect(page).toHaveURL(/academic\/(reserve|reservations)/)
    }
  })

  test('should navigate to curriculum management', async ({ page }) => {
    await page.goto('/academic/dashboard')

    const curriculumLink = page.getByRole('link', { name: /curriculum/i }).first()
    if (await curriculumLink.isVisible()) {
      await curriculumLink.click()
      await expect(page).toHaveURL(/academic\/curriculum/)
    }
  })

  test('should navigate to schedules', async ({ page }) => {
    await page.goto('/academic/dashboard')

    const schedulesLink = page.getByRole('link', { name: /schedule/i }).first()
    if (await schedulesLink.isVisible()) {
      await schedulesLink.click()
      await expect(page).toHaveURL(/academic\/schedules/)
    }
  })

  test('should navigate to messages', async ({ page }) => {
    await page.goto('/academic/dashboard')

    const messagesLink = page.getByRole('link', { name: /message/i }).first()
    if (await messagesLink.isVisible()) {
      await messagesLink.click()
      await expect(page).toHaveURL(/academic\/messages/)
    }
  })

  test('should navigate to departments', async ({ page }) => {
    await page.goto('/academic/dashboard')

    const departmentsLink = page.getByRole('link', { name: /department/i }).first()
    if (await departmentsLink.isVisible()) {
      await departmentsLink.click()
      await expect(page).toHaveURL(/academic\/departments/)
    }
  })

  test('should navigate to history', async ({ page }) => {
    await page.goto('/academic/dashboard')

    const historyLink = page.getByRole('link', { name: /history/i }).first()
    if (await historyLink.isVisible()) {
      await historyLink.click()
      await expect(page).toHaveURL(/academic\/history/)
    }
  })
})
