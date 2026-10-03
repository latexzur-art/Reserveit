import { test, expect } from '@playwright/test'

test.describe('Academic Head Curriculum Management', () => {
  test('should load the curriculum page', async ({ page }) => {
    await page.goto('/academic/curriculum')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('should navigate to course catalog', async ({ page }) => {
    await page.goto('/academic/curriculum/course-catalog')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/curriculum\/course-catalog/)
  })

  test('should navigate to approval queue', async ({ page }) => {
    await page.goto('/academic/curriculum/approval-queue')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/curriculum\/approval-queue/)
  })

  test('should navigate to term offerings', async ({ page }) => {
    await page.goto('/academic/curriculum/term-offerings')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/curriculum\/term-offerings/)
  })

  test('should navigate to upload history', async ({ page }) => {
    await page.goto('/academic/curriculum/upload-history')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/curriculum\/upload-history/)
  })

  test('course catalog should display courses or empty state', async ({ page }) => {
    await page.goto('/academic/curriculum/course-catalog')
    await page.waitForLoadState('networkidle')

    const hasCourses = await page.locator('table, [class*="card"], [data-testid="course-list"]').count()
    const hasEmptyState = await page.getByText(/no courses|empty|no data/i).count()

    expect(hasCourses > 0 || hasEmptyState > 0).toBe(true)
  })
})
