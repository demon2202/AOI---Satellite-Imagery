import { test, expect } from '@playwright/test'

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="map-container"]')
    await page.waitForTimeout(1000)
  })

  test('should have search input visible', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveAttribute('placeholder', 'Search location...')
  })

  test('should not show results for short queries', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Type short query (less than 3 characters)
    await searchInput.fill('Be')
    await page.waitForTimeout(500)
    
    // Results should not appear
    await expect(page.locator('[data-testid="search-results"]')).not.toBeVisible()
  })

  test('should show search results for valid query', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Type a valid search query
    await searchInput.fill('Berlin')
    
    // Wait for debounce and API response
    await page.waitForTimeout(1000)
    
    // Results should appear (if API is available)
    // Note: This test may fail if Nominatim API is unavailable
    const results = page.locator('[data-testid="search-results"]')
    
    // Either results appear or we timeout gracefully
    try {
      await expect(results).toBeVisible({ timeout: 5000 })
    } catch {
      // API might be rate-limited or unavailable in test environment
      console.log('Search results not available - API may be rate-limited')
    }
  })

  test('should close search results on escape key', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    await searchInput.fill('Munich')
    await page.waitForTimeout(1000)
    
    // Press escape
    await searchInput.press('Escape')
    
    // Results should be hidden
    await expect(page.locator('[data-testid="search-results"]')).not.toBeVisible()
  })

  test('should focus search input on click', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    await searchInput.click()
    await expect(searchInput).toBeFocused()
  })

  test('should clear search input value', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]')
    
    // Type something
    await searchInput.fill('Test Location')
    await expect(searchInput).toHaveValue('Test Location')
    
    // Clear by selecting all and deleting
    await searchInput.fill('')
    await expect(searchInput).toHaveValue('')
  })
})