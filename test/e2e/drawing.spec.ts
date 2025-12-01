import { test, expect } from '@playwright/test'

test.describe('Drawing Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for map to load
    await page.waitForSelector('[data-testid="map-container"]')
    await page.waitForTimeout(2000)
    
    // Clear any existing features from localStorage
    await page.evaluate(() => {
      localStorage.removeItem('aoi-features')
    })
    await page.reload()
    await page.waitForSelector('[data-testid="map-container"]')
    await page.waitForTimeout(1000)
  })

  test('should show drawing tools in sidebar', async ({ page }) => {
    // Check all drawing tool buttons are visible
    await expect(page.locator('[data-testid="draw-polygon-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="draw-rectangle-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="draw-circle-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="draw-marker-btn"]')).toBeVisible()
  })

  test('should activate and deactivate drawing mode', async ({ page }) => {
    const polygonBtn = page.locator('[data-testid="draw-polygon-btn"]')
    
    // Click to activate
    await polygonBtn.click()
    
    // Check drawing indicator appears
    await expect(page.locator('[data-testid="drawing-indicator"]')).toBeVisible()
    await expect(page.locator('[data-testid="drawing-indicator"]')).toContainText('Drawing polygon')
    
    // Check cancel button appears
    await expect(page.locator('[data-testid="cancel-draw-btn"]')).toBeVisible()
    
    // Click cancel to deactivate
    await page.locator('[data-testid="cancel-draw-btn"]').click()
    
    // Check drawing indicator disappears
    await expect(page.locator('[data-testid="drawing-indicator"]')).not.toBeVisible()
  })

  test('should toggle between different drawing tools', async ({ page }) => {
    // Activate polygon
    await page.locator('[data-testid="draw-polygon-btn"]').click()
    await expect(page.locator('[data-testid="drawing-indicator"]')).toContainText('polygon')
    
    // Switch to rectangle
    await page.locator('[data-testid="draw-rectangle-btn"]').click()
    await expect(page.locator('[data-testid="drawing-indicator"]')).toContainText('rectangle')
    
    // Switch to circle
    await page.locator('[data-testid="draw-circle-btn"]').click()
    await expect(page.locator('[data-testid="drawing-indicator"]')).toContainText('circle')
    
    // Switch to marker
    await page.locator('[data-testid="draw-marker-btn"]').click()
    await expect(page.locator('[data-testid="drawing-indicator"]')).toContainText('marker')
  })

  test('should show empty state when no features exist', async ({ page }) => {
    const aoiList = page.locator('[data-testid="aoi-list"]')
    await expect(aoiList).toContainText('No areas defined yet')
  })

  test('should display feature count correctly', async ({ page }) => {
    const featureCount = page.locator('[data-testid="feature-count"]')
    await expect(featureCount).toHaveText('0 features')
  })

  test('should have clear all button', async ({ page }) => {
    const clearAllBtn = page.locator('[data-testid="clear-all-btn"]')
    await expect(clearAllBtn).toBeVisible()
    await expect(clearAllBtn).toHaveText('Clear All')
  })

  test('should have export GeoJSON button', async ({ page }) => {
    const exportBtn = page.locator('[data-testid="export-btn"]')
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toHaveText('Export GeoJSON')
  })

  test('should toggle AOI layer visibility', async ({ page }) => {
    const aoiToggle = page.locator('[data-testid="aoi-toggle"]')
    
    // Initially should be checked
    await expect(aoiToggle).toBeChecked()
    
    // Toggle off
    await aoiToggle.click()
    await expect(aoiToggle).not.toBeChecked()
    
    // Toggle back on
    await aoiToggle.click()
    await expect(aoiToggle).toBeChecked()
  })
})