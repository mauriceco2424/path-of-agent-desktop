import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Skills Workflow (US4)
 *
 * Tests the complete skills gem swap workflow: review -> apply -> complete
 *
 * User Story (US4 - Skills Gem Swap Workflow):
 * A user clicks on a skills improvement card, sees the recommended gem changes,
 * and applies them to their PoB.
 *
 * Prerequisites:
 * - Application running at localhost:5174
 * - Backend running at localhost:9876
 * - PoB API available via Docker
 *
 * Test Data:
 * - Test build with suboptimal gem setup (using inferior support gem)
 */

test.describe('Skills Workflow (US4)', () => {
  // Test fixtures
  const TEST_BUILD_POB_CODE = 'eNrtV...'; // Replace with actual test PoB code with suboptimal gems

  test.beforeEach(async ({ page }) => {
    // Step 1: Navigate to application
    await page.goto('http://localhost:5174');

    // Step 2: Wait for application to load
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

    // Step 3: Import test build with suboptimal gems
    await page.locator('[data-testid="import-build-button"]').click();
    await page.locator('[data-testid="pob-code-input"]').fill(TEST_BUILD_POB_CODE);
    await page.locator('[data-testid="analyze-button"]').click();

    // Step 4: Wait for initial analysis to complete
    await expect(page.locator('[data-testid="pathway-cards"]')).toBeVisible({
      timeout: 30000,
    });

    // Step 5: Navigate to Skills pathway if not already there
    await page.locator('[data-testid="pathway-tab-skills"]').click();
  });

  test('complete gem swap workflow: review -> apply -> complete', async ({ page }) => {
    /**
     * FR-001: Card expands inline when clicked
     * FR-030: PoB simulation runs when skills card is expanded
     * FR-031: Before/after stat comparison displayed
     * FR-032: Gem changes shown with visual indicators
     * FR-034: Gem changes applied automatically to PoB via API
     */

    // Step 1: Click skills improvement card
    await page.locator('[data-testid="improvement-card-skills"]').first().click();

    // Step 2: Verify card expands with gem change details
    await expect(page.locator('[data-testid="skills-details-panel"]')).toBeVisible();

    /**
     * Acceptance Scenario 1:
     * Given an analyzed build with a skills improvement card,
     * When the user clicks the card,
     * Then the card expands showing the gem change details
     */

    // Step 3: Verify gem change details are displayed
    // Should show: Replace X with Y, Add Z, or Remove W
    await expect(page.locator('[data-testid="gem-change-details"]')).toBeVisible();
    const gemChangeText = await page.locator('[data-testid="gem-change-details"]').textContent();
    expect(gemChangeText).toMatch(/replace|add|remove|swap/i);

    // Step 4: Verify which gem is being changed
    await expect(page.locator('[data-testid="current-gem"]')).toBeVisible();
    await expect(page.locator('[data-testid="recommended-gem"]')).toBeVisible();

    /**
     * Acceptance Scenario 2:
     * Given a gem swap recommendation displayed,
     * When the user reviews the evidence,
     * Then they see DPS simulation results and meta usage statistics
     */

    // Step 5: Verify DPS simulation results are shown
    await expect(page.locator('[data-testid="stat-comparison"]')).toBeVisible();
    await expect(page.locator('[data-testid="dps-before"]')).toBeVisible();
    await expect(page.locator('[data-testid="dps-after"]')).toBeVisible();

    // Step 6: Verify stat delta (improvement) is calculated
    await expect(page.locator('[data-testid="dps-delta"]')).toBeVisible();
    const dpsDeltaText = await page.locator('[data-testid="dps-delta"]').textContent();
    expect(dpsDeltaText).toMatch(/[+-]?\d+/);

    // Step 7: Verify socket group information is shown
    await expect(page.locator('[data-testid="socket-group-info"]')).toBeVisible();

    /**
     * Acceptance Scenario 3:
     * Given the user accepts the gem change,
     * When they click "Apply to PoB",
     * Then the gem is swapped in the socket group, stat deltas are calculated,
     * and the card is marked complete
     */

    // Step 8: Verify "Apply to PoB" button is visible
    await expect(page.locator('[data-testid="apply-gem-button"]')).toBeVisible();

    // Step 9: Click "Apply to PoB"
    await page.locator('[data-testid="apply-gem-button"]').click();

    // Step 10: Verify loading state during apply
    await expect(page.locator('[data-testid="apply-loading"]')).toBeVisible();

    // Step 11: Wait for apply to complete
    await expect(page.locator('[data-testid="apply-loading"]')).not.toBeVisible({
      timeout: 15000,
    });

    /**
     * FR-041: Calculate and display actual stat deltas after apply
     * FR-042: Mark card as completed with visual completion overlay
     * FR-043: Update build's PoB code after successful apply
     * FR-044: Add applied change to change history with timestamp
     */

    // Step 12: Verify actual stat delta is displayed
    await expect(page.locator('[data-testid="actual-stat-delta"]')).toBeVisible();

    // Step 13: Verify card shows completion overlay
    await expect(
      page.locator('[data-testid="improvement-card-skills"]').first().locator('[data-testid="completion-overlay"]')
    ).toBeVisible();

    // Step 14: Verify completion checkmark is shown
    await expect(page.locator('[data-testid="completion-checkmark"]')).toBeVisible();

    // Step 15: Verify card is in completed/disabled state
    await expect(page.locator('[data-testid="improvement-card-skills"]').first()).toHaveClass(/completed|disabled/);
  });

  test('displays gem acquisition sources when needed', async ({ page }) => {
    /**
     * Acceptance Scenario 4:
     * Given a gem needs to be acquired,
     * When the user clicks "Find Gem",
     * Then gem acquisition sources are shown (vendor, drop location, trade)
     */

    // Step 1: Click skills improvement card
    await page.locator('[data-testid="improvement-card-skills"]').first().click();

    // Step 2: Check if "Find Gem" option is available
    // This appears when the recommended gem is not already owned
    const findGemButton = page.locator('[data-testid="find-gem-button"]');

    if (await findGemButton.isVisible()) {
      // Step 3: Click "Find Gem"
      await findGemButton.click();

      // Step 4: Verify acquisition sources panel appears
      await expect(page.locator('[data-testid="gem-acquisition-panel"]')).toBeVisible();

      // Step 5: Verify vendor source is shown
      await expect(page.locator('[data-testid="vendor-source"]')).toBeVisible();

      // Step 6: Verify drop location info is shown (if applicable)
      // Some gems drop from specific content
      const dropSource = page.locator('[data-testid="drop-source"]');
      if (await dropSource.isVisible()) {
        expect(await dropSource.textContent()).toBeTruthy();
      }

      // Step 7: Verify trade option is shown
      await expect(page.locator('[data-testid="trade-gem-button"]')).toBeVisible();
    }
  });

  test('handles multi-gem swap in single card', async ({ page }) => {
    /**
     * Test case for improvements that require multiple gem changes
     * (e.g., replace two supports, add awakened version)
     */

    // Step 1: Click skills improvement card that has multiple gem changes
    await page.locator('[data-testid="improvement-card-skills"]').first().click();

    // Step 2: Check if multiple gem changes are shown
    const gemChangeItems = page.locator('[data-testid="gem-change-item"]');
    const count = await gemChangeItems.count();

    if (count > 1) {
      // Step 3: Verify all gem changes are listed
      for (let i = 0; i < count; i++) {
        await expect(gemChangeItems.nth(i)).toBeVisible();
      }

      // Step 4: Verify combined stat delta for all changes
      await expect(page.locator('[data-testid="combined-stat-delta"]')).toBeVisible();

      // Step 5: Apply all changes at once
      await page.locator('[data-testid="apply-gem-button"]').click();

      // Step 6: Wait for completion
      await expect(page.locator('[data-testid="completion-overlay"]')).toBeVisible({
        timeout: 15000,
      });

      // Step 7: Verify all gems were applied
      await expect(page.locator('[data-testid="actual-stat-delta"]')).toBeVisible();
    }
  });

  test('shows error state with retry for API failures', async ({ page }) => {
    /**
     * Test error handling when gem apply fails
     */

    // Mock API to fail
    await page.route('**/api/v1/actions/apply-gem', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: 'PoB API temporarily unavailable',
          retryable: true,
        }),
      });
    });

    // Step 1: Click skills improvement card
    await page.locator('[data-testid="improvement-card-skills"]').first().click();

    // Step 2: Click apply
    await page.locator('[data-testid="apply-gem-button"]').click();

    // Step 3: Verify error message is shown
    await expect(page.locator('[data-testid="apply-error-message"]')).toBeVisible({
      timeout: 10000,
    });

    // Step 4: Verify retry button is available
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Step 5: Remove mock and retry
    await page.unroute('**/api/v1/actions/apply-gem');

    // Step 6: Click retry
    await page.locator('[data-testid="retry-button"]').click();

    // Step 7: Verify retry attempt starts (loading state)
    await expect(page.locator('[data-testid="apply-loading"]')).toBeVisible();
  });

  test('handles negative stat warning for gem changes', async ({ page }) => {
    /**
     * FR-041: If stat change is negative, show warning but allow user to proceed
     */

    // Step 1: Click skills improvement card
    await page.locator('[data-testid="improvement-card-skills"]').first().click();

    // Step 2: Check if this particular change shows negative stats
    // (This can happen if the LLM recommends a defensive gem swap)
    const dpsChangeElement = page.locator('[data-testid="dps-delta"]');
    const dpsChangeText = await dpsChangeElement.textContent();

    if (dpsChangeText?.includes('-')) {
      // Step 3: Verify warning is shown for negative DPS change
      await expect(page.locator('[data-testid="negative-stat-warning"]')).toBeVisible();

      // Step 4: Verify explanation is provided (e.g., "DPS decreases but survivability increases")
      await expect(page.locator('[data-testid="stat-tradeoff-explanation"]')).toBeVisible();

      // Step 5: Verify both "Apply Anyway" and "Cancel" options are available
      await expect(page.locator('[data-testid="apply-anyway-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-button"]')).toBeVisible();

      // Step 6: Click "Apply Anyway"
      await page.locator('[data-testid="apply-anyway-button"]').click();

      // Step 7: Verify apply proceeds
      await expect(page.locator('[data-testid="completion-overlay"]')).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test('validates socket group has capacity for new gem', async ({ page }) => {
    /**
     * Edge Case: Socket group validation
     * System should warn if adding a gem would exceed socket capacity
     */

    // Step 1: Click skills improvement card
    await page.locator('[data-testid="improvement-card-skills"]').first().click();

    // Step 2: Check if socket capacity warning is shown
    const capacityWarning = page.locator('[data-testid="socket-capacity-warning"]');

    if (await capacityWarning.isVisible()) {
      // Step 3: Verify warning message explains the issue
      await expect(capacityWarning).toContainText(/socket|capacity|full/i);

      // Step 4: Verify suggestion to modify sockets is provided
      await expect(page.locator('[data-testid="socket-modification-hint"]')).toBeVisible();
    }
  });

  test('displays gem level and quality information', async ({ page }) => {
    /**
     * Test that gem level/quality is shown for recommendations
     */

    // Step 1: Click skills improvement card
    await page.locator('[data-testid="improvement-card-skills"]').first().click();

    // Step 2: Verify gem level is shown
    await expect(page.locator('[data-testid="gem-level"]')).toBeVisible();
    const gemLevel = await page.locator('[data-testid="gem-level"]').textContent();
    expect(Number(gemLevel)).toBeGreaterThanOrEqual(1);
    expect(Number(gemLevel)).toBeLessThanOrEqual(21);

    // Step 3: Verify gem quality is shown
    await expect(page.locator('[data-testid="gem-quality"]')).toBeVisible();
    const gemQuality = await page.locator('[data-testid="gem-quality"]').textContent();
    expect(Number(gemQuality?.replace('%', ''))).toBeGreaterThanOrEqual(0);
    expect(Number(gemQuality?.replace('%', ''))).toBeLessThanOrEqual(23);
  });

  test('persists skills card state across page refresh', async ({ page }) => {
    /**
     * FR-004: Card expansion state persists using session storage
     */

    // Step 1: Expand a skills card
    await page.locator('[data-testid="improvement-card-skills"]').first().click();
    await expect(page.locator('[data-testid="skills-details-panel"]')).toBeVisible();

    // Step 2: Refresh the page
    await page.reload();

    // Step 3: Wait for app to reload and navigate to Skills pathway
    await expect(page.locator('[data-testid="pathway-cards"]')).toBeVisible({
      timeout: 30000,
    });
    await page.locator('[data-testid="pathway-tab-skills"]').click();

    // Step 4: Verify card is still expanded
    await expect(page.locator('[data-testid="skills-details-panel"]')).toBeVisible();
  });

  test('updates build tracker after gem apply', async ({ page }) => {
    /**
     * FR-050: Track all applied improvements with stat deltas
     * FR-051: Display cumulative impact across all changes
     */

    // Step 1: Note initial build tracker state
    const initialTrackerText = await page.locator('[data-testid="build-tracker"]').textContent();

    // Step 2: Apply gem change
    await page.locator('[data-testid="improvement-card-skills"]').first().click();
    await page.locator('[data-testid="apply-gem-button"]').click();

    // Step 3: Wait for completion
    await expect(page.locator('[data-testid="completion-overlay"]')).toBeVisible({
      timeout: 15000,
    });

    // Step 4: Verify build tracker updated
    const updatedTrackerText = await page.locator('[data-testid="build-tracker"]').textContent();
    expect(updatedTrackerText).not.toEqual(initialTrackerText);

    // Step 5: Verify change history shows the gem change
    await page.locator('[data-testid="view-change-history"]').click();
    await expect(page.locator('[data-testid="change-history-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="change-history-item"]').first()).toContainText(/gem|skill/i);
  });
});
