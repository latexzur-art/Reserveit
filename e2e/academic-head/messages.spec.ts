import { test, expect } from '@playwright/test'

test.describe('Academic Head Messages', () => {
  test('should load the messages page', async ({ page }) => {
    await page.goto('/academic/messages')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/academic\/messages/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should display messages or empty state', async ({ page }) => {
    await page.goto('/academic/messages')
    await page.waitForLoadState('networkidle')

    const hasMessages = await page.locator('[class*="message"], [class*="card"], table').count()
    const hasEmptyState = await page.getByText(/no messages|empty|inbox is empty/i).count()

    expect(hasMessages > 0 || hasEmptyState > 0).toBe(true)
  })
})
