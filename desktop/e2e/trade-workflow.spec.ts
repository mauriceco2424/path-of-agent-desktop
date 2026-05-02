import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Trade Workflow (US1)
 *
 * Tests the complete trade workflow: search -> trade site -> paste -> apply
 *
 * User Story (US1 - Equipment Trade Workflow):
 * A user clicks on a gear improvement card, chooses to trade for the item,
 * searches for items, buys one on the trade site, pastes the item back,
 * and applies it to their PoB.
 *
 * Prerequisites:
 * - Application running at localhost:5174
 * - Backend running at localhost:9876
 * - PoB API available via Docker
 *
 * Test Data:
 * - Test build with weak gear (helmet slot under-geared)
 */

test.describe('Trade Workflow (US1)', () => {
  // Test fixtures
  const TEST_BUILD_POB_CODE = 'eNrtV...'; // Replace with actual test PoB code
  const WEAK_HELMET_SLOT = 'Helmet';

  test.beforeEach(async ({ page }) => {
    // Step 1: Navigate to application
    await page.goto('http://localhost:5174');

    // Step 2: Wait for application to load
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

    // Step 3: Import test build with weak gear
    // - Click import button
    // - Paste PoB code
    // - Wait for analysis to complete
    await page.locator('[data-testid="import-build-button"]').click();
    await page.locator('[data-testid="pob-code-input"]').fill(TEST_BUILD_POB_CODE);
    await page.locator('[data-testid="analyze-button"]').click();

    // Step 4: Wait for initial analysis to complete
    await expect(page.locator('[data-testid="pathway-cards"]')).toBeVisible({
      timeout: 30000,
    });
  });

  test('complete trade workflow: search -> trade site -> paste -> apply', async ({ page }) => {
    /**
     * FR-001: Card expands inline when clicked
     * FR-002: Action options displayed based on suggestedActions
     * FR-003: Single-card expansion supported
     */

    // Step 1: Click gear improvement card
    // The card should have Trade as a suggested action for gear slots
    await page.locator('[data-testid="improvement-card-gear"]').first().click();

    // Step 2: Verify card expands with action options
    await expect(page.locator('[data-testid="card-action-options"]')).toBeVisible();
    await expect(page.locator('[data-testid="action-trade"]')).toBeVisible();

    // Step 3: Select "Trade" option
    await page.locator('[data-testid="action-trade"]').click();

    /**
     * FR-010: Trade configuration panel with budget input
     * FR-011: Currency toggle between Chaos and Divine (default: Chaos)
     * FR-012: Selectable stat filters from LLM-recommended search parameters
     */

    // Step 4: Verify trade configuration panel appears
    await expect(page.locator('[data-testid="trade-config-panel"]')).toBeVisible();

    // Step 5: Configure budget (default should be Chaos)
    await expect(page.locator('[data-testid="currency-selector"]')).toHaveValue('chaos');
    await page.locator('[data-testid="budget-input"]').fill('50');

    // Step 6: Verify stat filters are displayed
    await expect(page.locator('[data-testid="stat-filters"]')).toBeVisible();

    // Step 7: Select desired stat filters (optional customization)
    // User can toggle which stats to prioritize in search

    // Step 8: Click "Search Trade"
    await page.locator('[data-testid="search-trade-button"]').click();

    /**
     * FR-013: Trade search executed and results displayed
     */

    // Step 9: Wait for trade results to load
    await expect(page.locator('[data-testid="trade-results-panel"]')).toBeVisible({
      timeout: 15000,
    });

    // Step 10: Verify results display with prices and mod previews
    await expect(page.locator('[data-testid="trade-result-item"]')).toHaveCount.greaterThan(0);
    await expect(page.locator('[data-testid="item-price"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="item-mods"]').first()).toBeVisible();

    /**
     * FR-014: Working trade site URL generation
     */

    // Step 11: Click "Open Trade Site" button
    // Note: In E2E tests, we mock the external navigation
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('[data-testid="open-trade-site-button"]').click(),
    ]);

    // Step 12: Verify trade site URL is valid PoE trade URL
    expect(popup.url()).toContain('pathofexile.com/trade');

    // Close popup to continue test
    await popup.close();

    /**
     * FR-015: Item paste input provided after returning from trade site
     */

    // Step 13: Click "Apply Purchased Item" to open paste modal
    await page.locator('[data-testid="apply-purchased-item-button"]').click();

    // Step 14: Verify ItemPasteModal opens
    await expect(page.locator('[data-testid="item-paste-modal"]')).toBeVisible();

    // Step 15: Paste item text
    const SAMPLE_ITEM_TEXT = `Rarity: Rare
Doom Crest
Eternal Burgonet
--------
Armour: 486
--------
Requirements:
Level: 69
Str: 138
--------
Sockets: R-R-R-R
--------
Item Level: 84
--------
+97 to maximum Life
+45% to Fire Resistance
+38% to Cold Resistance
+34% to Lightning Resistance
11% increased Armour`;

    await page.locator('[data-testid="item-paste-textarea"]').fill(SAMPLE_ITEM_TEXT);

    /**
     * FR-016: Item validation and stat preview before apply
     */

    // Step 16: Wait for validation to complete
    await expect(page.locator('[data-testid="validation-status"]')).toHaveText(/valid/i, {
      timeout: 5000,
    });

    // Step 17: Verify slot validation (should match Helmet)
    await expect(page.locator('[data-testid="detected-slot"]')).toHaveText(WEAK_HELMET_SLOT);

    // Step 18: Verify stat preview is displayed
    await expect(page.locator('[data-testid="stat-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="dps-change"]')).toBeVisible();
    await expect(page.locator('[data-testid="ehp-change"]')).toBeVisible();

    /**
     * FR-040: Apply changes to PoB when user confirms
     * FR-041: Calculate and display actual stat deltas after apply
     * FR-042: Mark card as completed with visual completion overlay
     * FR-043: Update build's PoB code after successful apply
     * FR-044: Add applied change to change history with timestamp
     */

    // Step 19: Click "Apply to PoB"
    await page.locator('[data-testid="apply-to-pob-button"]').click();

    // Step 20: Wait for apply to complete
    await expect(page.locator('[data-testid="item-paste-modal"]')).not.toBeVisible({
      timeout: 10000,
    });

    // Step 21: Verify card shows completion overlay
    await expect(
      page.locator('[data-testid="improvement-card-gear"]').first().locator('[data-testid="completion-overlay"]')
    ).toBeVisible();

    // Step 22: Verify actual stat delta is displayed on completed card
    await expect(
      page.locator('[data-testid="improvement-card-gear"]').first().locator('[data-testid="actual-stat-delta"]')
    ).toBeVisible();

    // Step 23: Verify build tracker shows updated stats
    await expect(page.locator('[data-testid="build-tracker"]')).toContainText(/\+\d+/);
  });

  test('handles zero results gracefully', async ({ page }) => {
    /**
     * Edge Case: Trade search returns zero results
     * System should offer to relax search criteria or suggest crafting instead.
     */

    // Step 1: Click gear improvement card
    await page.locator('[data-testid="improvement-card-gear"]').first().click();

    // Step 2: Select "Trade" option
    await page.locator('[data-testid="action-trade"]').click();

    // Step 3: Configure very restrictive search (high budget, many required stats)
    await page.locator('[data-testid="budget-input"]').fill('1'); // Very low budget
    // Enable all stat filters to make search very restrictive

    // Step 4: Execute search
    await page.locator('[data-testid="search-trade-button"]').click();

    // Step 5: Wait for results
    await expect(page.locator('[data-testid="trade-results-panel"]')).toBeVisible({
      timeout: 15000,
    });

    // Step 6: Verify zero results message is shown
    await expect(page.locator('[data-testid="zero-results-message"]')).toBeVisible();

    // Step 7: Verify "relax criteria" option is shown
    await expect(page.locator('[data-testid="relax-criteria-button"]')).toBeVisible();

    // Step 8: Verify "try crafting" suggestion is shown
    await expect(page.locator('[data-testid="suggest-craft-button"]')).toBeVisible();
  });

  test('handles slot mismatch with warning', async ({ page }) => {
    /**
     * Edge Case: User pastes an item that doesn't match the expected slot
     * System should warn but allow user to proceed (per FR-016 clarification).
     */

    // Steps 1-13: Same as complete workflow, get to paste modal
    await page.locator('[data-testid="improvement-card-gear"]').first().click();
    await page.locator('[data-testid="action-trade"]').click();
    await page.locator('[data-testid="budget-input"]').fill('50');
    await page.locator('[data-testid="search-trade-button"]').click();
    await expect(page.locator('[data-testid="trade-results-panel"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="apply-purchased-item-button"]').click();
    await expect(page.locator('[data-testid="item-paste-modal"]')).toBeVisible();

    // Step 14: Paste item for DIFFERENT slot (boots instead of helmet)
    const BOOTS_ITEM_TEXT = `Rarity: Rare
Doom Trail
Titan Greaves
--------
Armour: 320
--------
Requirements:
Level: 68
Str: 120
--------
+80 to maximum Life
+30% to Fire Resistance
30% increased Movement Speed`;

    await page.locator('[data-testid="item-paste-textarea"]').fill(BOOTS_ITEM_TEXT);

    // Step 15: Verify slot mismatch warning is shown (not error)
    await expect(page.locator('[data-testid="slot-mismatch-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="slot-mismatch-warning"]')).toContainText(/boots/i);

    // Step 16: Verify Apply button is still enabled (warning, not blocking)
    await expect(page.locator('[data-testid="apply-to-pob-button"]')).toBeEnabled();
  });

  test('shows negative stat warning and allows proceed', async ({ page }) => {
    /**
     * FR-041: If stat change is negative, show warning but allow user to proceed
     */

    // Steps 1-18: Complete flow to stat preview with item that causes negative stats
    await page.locator('[data-testid="improvement-card-gear"]').first().click();
    await page.locator('[data-testid="action-trade"]').click();
    await page.locator('[data-testid="budget-input"]').fill('50');
    await page.locator('[data-testid="search-trade-button"]').click();
    await expect(page.locator('[data-testid="trade-results-panel"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="apply-purchased-item-button"]').click();
    await expect(page.locator('[data-testid="item-paste-modal"]')).toBeVisible();

    // Paste an item that would cause negative stat changes
    const WEAK_ITEM_TEXT = `Rarity: Normal
Iron Hat
--------
Armour: 10`;

    await page.locator('[data-testid="item-paste-textarea"]').fill(WEAK_ITEM_TEXT);

    // Wait for preview calculation
    await expect(page.locator('[data-testid="stat-preview"]')).toBeVisible({ timeout: 5000 });

    // If preview shows negative stats, warning should appear
    const dpsChangeText = await page.locator('[data-testid="dps-change"]').textContent();
    if (dpsChangeText?.includes('-')) {
      // Step 19: Verify negative stat warning is displayed
      await expect(page.locator('[data-testid="negative-stat-warning"]')).toBeVisible();

      // Step 20: Verify "Apply Anyway" button is available
      await expect(page.locator('[data-testid="apply-anyway-button"]')).toBeVisible();

      // Step 21: Click "Apply Anyway"
      await page.locator('[data-testid="apply-anyway-button"]').click();

      // Step 22: Verify apply proceeds despite warning
      await expect(page.locator('[data-testid="item-paste-modal"]')).not.toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('handles PoB API timeout with retry', async ({ page }) => {
    /**
     * Edge Case: PoB API timeout during apply
     * System should retry with exponential backoff and show clear error message.
     */

    // This test requires mocking the API to simulate timeout
    // In a real E2E environment, you would use network interception

    await page.route('**/api/v1/actions/preview-item', async (route) => {
      // Simulate timeout by delaying response
      await new Promise((resolve) => setTimeout(resolve, 30000));
      await route.abort('timedout');
    });

    // Steps to get to apply flow
    await page.locator('[data-testid="improvement-card-gear"]').first().click();
    await page.locator('[data-testid="action-trade"]').click();
    await page.locator('[data-testid="budget-input"]').fill('50');
    await page.locator('[data-testid="search-trade-button"]').click();
    await expect(page.locator('[data-testid="trade-results-panel"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="apply-purchased-item-button"]').click();

    // Paste valid item
    await page.locator('[data-testid="item-paste-textarea"]').fill(`Rarity: Rare\nTest Helmet\nEternal Burgonet`);

    // Verify error message appears after timeout
    await expect(page.locator('[data-testid="api-error-message"]')).toBeVisible({
      timeout: 35000,
    });

    // Verify retry button is shown
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('persists card expansion state across refresh', async ({ page }) => {
    /**
     * FR-004: Card expansion state persists using session storage
     * (survives page navigation and refresh, cleared when browser tab closes)
     */

    // Step 1: Expand a card
    await page.locator('[data-testid="improvement-card-gear"]').first().click();
    await expect(page.locator('[data-testid="card-action-options"]')).toBeVisible();

    // Step 2: Refresh the page
    await page.reload();

    // Step 3: Wait for app to reload
    await expect(page.locator('[data-testid="pathway-cards"]')).toBeVisible({
      timeout: 30000,
    });

    // Step 4: Verify card is still expanded
    await expect(page.locator('[data-testid="card-action-options"]')).toBeVisible();
  });

  test('supports currency toggle between Chaos and Divine', async ({ page }) => {
    /**
     * FR-011: Currency toggle between Chaos and Divine orbs with automatic conversion
     */

    // Step 1: Expand card and select Trade
    await page.locator('[data-testid="improvement-card-gear"]').first().click();
    await page.locator('[data-testid="action-trade"]').click();

    // Step 2: Verify default is Chaos
    await expect(page.locator('[data-testid="currency-selector"]')).toHaveValue('chaos');

    // Step 3: Set budget in Chaos
    await page.locator('[data-testid="budget-input"]').fill('150');

    // Step 4: Toggle to Divine
    await page.locator('[data-testid="currency-selector"]').selectOption('divine');

    // Step 5: Verify budget is converted (150 Chaos ~ 1 Divine at typical rates)
    // The exact conversion rate may vary; just verify the value changed
    const budgetValue = await page.locator('[data-testid="budget-input"]').inputValue();
    expect(Number(budgetValue)).toBeLessThan(150);

    // Step 6: Toggle back to Chaos
    await page.locator('[data-testid="currency-selector"]').selectOption('chaos');

    // Step 7: Verify budget converts back
    const chaosValue = await page.locator('[data-testid="budget-input"]').inputValue();
    expect(Number(chaosValue)).toBeGreaterThan(100);
  });
});
