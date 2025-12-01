import { test, expect } from '@playwright/test'

test.describe('Map Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for map to load
    await page.waitForSelector('[data-testid="map-container"]')
    // Give map tiles time to load
    await page.waitForTimeout(2000)
  })

  test('should load the map successfully', async ({ page }) => {
    // Check that the map container exists
    const mapContainer = page.locator('[data-testid="map-container"]')
    await expect(mapContainer).toBeVisible()

    // Check that zoom controls are visible
    await expect(page.locator('[data-testid="zoom-in-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="zoom-out-btn"]')).toBeVisible()

    // Check that the sidebar is visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
  })

  test('should zoom in and out using controls', async ({ page }) => {
    // Get initial zoom level
    const initialZoom = await page.locator('[data-testid="zoom-level"]').textContent()
    
    // Click zoom in
    await page.locator('[data-testid="zoom-in-btn"]').click()
    await page.waitForTimeout(500)
    
    // Check zoom increased
    const zoomedInLevel = await page.locator('[data-testid="zoom-level"]').textContent()
    expect(parseInt(zoomedInLevel || '0')).toBeGreaterThan(parseInt(initialZoom || '0'))

    // Click zoom out twice
    await page.locator('[data-testid="zoom-out-btn"]').click()
    await page.waitForTimeout(500)
    await page.locator('[data-testid="zoom-out-btn"]').click()
    await page.waitForTimeout(500)

    // Check zoom decreased
    const zoomedOutLevel = await page.locator('[data-testid="zoom-level"]').textContent()
    expect(parseInt(zoomedOutLevel || '0')).toBeLessThan(parseInt(zoomedInLevel || '0'))
  })

  test('should reset view when reset button is clicked', async ({ page }) => {
    // Zoom in first
    await page.locator('[data-testid="zoom-in-btn"]').click()
    await page.locator('[data-testid="zoom-in-btn"]').click()
    await page.waitForTimeout(500)

    // Click reset view
    await page.locator('[data-testid="reset-view-btn"]').click()
    await page.waitForTimeout(500)

    // Check zoom is back to default (5 for India)
    const zoomLevel = await page.locator('[data-testid="zoom-level"]').textContent()
    expect(zoomLevel).toBe('5')
  })

  test('should display coordinates on mouse move', async ({ page }) => {
    const coordinatesDisplay = page.locator('[data-testid="coordinates"]')
    await expect(coordinatesDisplay).toBeVisible()
    
    // Initial coordinates should be displayed
    const initialCoords = await coordinatesDisplay.textContent()
    expect(initialCoords).toMatch(/\d+\.\d+°[NS], \d+\.\d+°[EW]/)
  })

  test('should toggle WMS layer visibility', async ({ page }) => {
    const wmsToggle = page.locator('[data-testid="wms-toggle"]')
    
    // Initially should be checked
    await expect(wmsToggle).toBeChecked()
    
    // Toggle off
    await wmsToggle.click()
    await expect(wmsToggle).not.toBeChecked()
    
    // Toggle back on
    await wmsToggle.click()
    await expect(wmsToggle).toBeChecked()
  })

  test('should change WMS opacity', async ({ page }) => {
    const opacitySlider = page.locator('[data-testid="opacity-slider"]')
    const opacityValue = page.locator('[data-testid="opacity-value"]')
    
    // Initial opacity should be 100%
    await expect(opacityValue).toHaveText('100%')
    
    // Change opacity using slider
    await opacitySlider.fill('50')
    await expect(opacityValue).toHaveText('50%')
  })
})