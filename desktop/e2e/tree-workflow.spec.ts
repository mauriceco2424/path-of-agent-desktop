import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Tree Workflow (US3)
 *
 * Tests the complete tree simulation and apply workflow
 *
 * User Story (US3 - Tree Simulation and Apply Workflow):
 * A user clicks on a tree improvement card, sees the simulated impact
 * of the passive changes, and applies them to their PoB.
 *
 * Prerequisites:
 * - Application running at localhost:5174
 * - Backend running at localhost:9876
 * - PoB API available via Docker
 *
 * Test Data:
 * - Test build with unallocated passive points or suboptimal pathing
 */

test.describe('Tree Workflow (US3)', () => {
  // Test fixtures
  const TEST_BUILD_POB_CODE = 'eNrtV...'; // Replace with actual test PoB code with unallocated points

  test.beforeEach(async ({ page }) => {
    // Step 1: Navigate to application
    await page.goto('http://localhost:5174');

    // Step 2: Wait for application to load
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

    // Step 3: Import test build with tree optimization opportunities
    await page.locator('[data-testid="import-build-button"]').click();
    await page.locator('[data-testid="pob-code-input"]').fill(TEST_BUILD_POB_CODE);
    await page.locator('[data-testid="analyze-button"]').click();

    // Step 4: Wait for initial analysis to complete
    await expect(page.locator('[data-testid="pathway-cards"]')).toBeVisible({
      timeout: 30000,
    });

    // Step 5: Navigate to Tree pathway
    await page.locator('[data-testid="pathway-tab-tree"]').click();
  });

  test('complete tree allocation workflow: view simulation -> apply -> complete', async ({ page }) => {
    /**
     * FR-001: Card expands inline when clicked
     * FR-030: PoB simulation runs when tree card is expanded
     * FR-031: Before/after stat comparison displayed
     * FR-032: Node changes shown with visual indicators
     */

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    /**
     * Acceptance Scenario 1:
     * Given an analyzed build with a tree improvement card,
     * When the user clicks the card,
     * Then the card expands showing simulated stat comparison
     */

    // Step 2: Verify card expands with tree simulation panel
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Verify before/after stat comparison is displayed
    await expect(page.locator('[data-testid="stat-comparison"]')).toBeVisible();
    await expect(page.locator('[data-testid="dps-before"]')).toBeVisible();
    await expect(page.locator('[data-testid="dps-after"]')).toBeVisible();
    await expect(page.locator('[data-testid="ehp-before"]')).toBeVisible();
    await expect(page.locator('[data-testid="ehp-after"]')).toBeVisible();
    await expect(page.locator('[data-testid="life-before"]')).toBeVisible();
    await expect(page.locator('[data-testid="life-after"]')).toBeVisible();

    /**
     * Acceptance Scenario 2:
     * Given tree simulation results displayed,
     * When the user reviews the node changes,
     * Then they see which nodes will be allocated/deallocated with point cost summary
     */

    // Step 4: Verify node changes are displayed with visual indicators
    await expect(page.locator('[data-testid="node-changes-list"]')).toBeVisible();

    // Step 5: Verify allocated nodes are shown (green/+ indicator)
    const allocatedNodes = page.locator('[data-testid="node-allocate"]');
    if ((await allocatedNodes.count()) > 0) {
      await expect(allocatedNodes.first()).toBeVisible();
      await expect(allocatedNodes.first()).toHaveClass(/allocate|add|green/);
    }

    // Step 6: Verify deallocated nodes are shown if any (red/- indicator)
    const deallocatedNodes = page.locator('[data-testid="node-deallocate"]');
    if ((await deallocatedNodes.count()) > 0) {
      await expect(deallocatedNodes.first()).toHaveClass(/deallocate|remove|red/);
    }

    /**
     * FR-032: Point cost summary displayed
     */

    // Step 7: Verify point cost summary is displayed
    await expect(page.locator('[data-testid="point-cost-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="points-to-allocate"]')).toBeVisible();
    await expect(page.locator('[data-testid="points-to-refund"]')).toBeVisible();
    await expect(page.locator('[data-testid="net-point-change"]')).toBeVisible();

    /**
     * Acceptance Scenario 3:
     * Given the user accepts the tree changes,
     * When they click "Apply to PoB",
     * Then the passive tree is updated, actual stat deltas are calculated,
     * and the card is marked complete
     */

    // Step 8: Verify "Apply to PoB" button is visible
    await expect(page.locator('[data-testid="apply-tree-button"]')).toBeVisible();

    // Step 9: Click "Apply to PoB"
    await page.locator('[data-testid="apply-tree-button"]').click();

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
     */

    // Step 12: Verify actual stat delta is displayed
    await expect(page.locator('[data-testid="actual-stat-delta"]')).toBeVisible();

    // Step 13: Verify card shows completion overlay
    await expect(
      page.locator('[data-testid="improvement-card-tree"]').first().locator('[data-testid="completion-overlay"]')
    ).toBeVisible();

    // Step 14: Verify completion checkmark is shown
    await expect(page.locator('[data-testid="completion-checkmark"]')).toBeVisible();

    // Step 15: Verify card is in completed/disabled state
    await expect(page.locator('[data-testid="improvement-card-tree"]').first()).toHaveClass(/completed|disabled/);
  });

  test('shows point overflow warning when exceeding available points', async ({ page }) => {
    /**
     * Edge Case: Tree change would exceed available passive points
     * System should warn before apply and show point deficit
     */

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    // Step 2: Wait for simulation to load
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Check for point overflow warning
    const pointOverflowWarning = page.locator('[data-testid="point-overflow-warning"]');

    // If the test build has a tree change that exceeds available points:
    if (await pointOverflowWarning.isVisible()) {
      // Step 4: Verify warning message shows point deficit
      await expect(pointOverflowWarning).toContainText(/exceed|overflow|insufficient|deficit/i);

      // Step 5: Verify the deficit amount is shown
      await expect(page.locator('[data-testid="point-deficit"]')).toBeVisible();
      const deficitText = await page.locator('[data-testid="point-deficit"]').textContent();
      expect(deficitText).toMatch(/\d+/);

      // Step 6: Verify Apply button is disabled when overflow
      await expect(page.locator('[data-testid="apply-tree-button"]')).toBeDisabled();

      // Step 7: Verify suggestion to level up or refund points is shown
      await expect(page.locator('[data-testid="point-overflow-suggestion"]')).toBeVisible();
    }
  });

  test('warns about tree connectivity issues', async ({ page }) => {
    /**
     * Acceptance Scenario 4:
     * Given tree changes would break path connectivity,
     * When the simulation runs,
     * Then the system warns the user and suggests alternative pathing
     *
     * FR-033: Validate tree changes don't break path connectivity before apply
     */

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    // Step 2: Wait for simulation to load
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Check for connectivity warning
    const connectivityWarning = page.locator('[data-testid="connectivity-warning"]');

    if (await connectivityWarning.isVisible()) {
      // Step 4: Verify warning explains the connectivity issue
      await expect(connectivityWarning).toContainText(/disconnect|path|connection|orphan/i);

      // Step 5: Verify which nodes would be disconnected
      await expect(page.locator('[data-testid="disconnected-nodes"]')).toBeVisible();

      // Step 6: Verify alternative pathing suggestion is shown
      await expect(page.locator('[data-testid="alternative-path-suggestion"]')).toBeVisible();

      // Step 7: Verify user can still proceed with warning (non-blocking)
      await expect(page.locator('[data-testid="apply-tree-button"]')).toBeEnabled();
    }
  });

  test('handles keystone allocation recommendations', async ({ page }) => {
    /**
     * Test for tree improvements that include keystone changes
     * Keystones have special visibility and impact
     */

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    // Step 2: Wait for simulation to load
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Check if keystone changes are included
    const keystoneChanges = page.locator('[data-testid="keystone-change"]');

    if ((await keystoneChanges.count()) > 0) {
      // Step 4: Verify keystone is highlighted specially
      await expect(keystoneChanges.first()).toHaveClass(/keystone|notable|highlighted/);

      // Step 5: Verify keystone effects are explained
      await expect(page.locator('[data-testid="keystone-effects"]')).toBeVisible();

      // Step 6: Verify keystone tradeoffs are shown (keystones have downsides)
      await expect(page.locator('[data-testid="keystone-tradeoffs"]')).toBeVisible();
    }
  });

  test('shows error state with retry for API failures', async ({ page }) => {
    /**
     * Test error handling when tree apply fails
     */

    // Mock API to fail
    await page.route('**/api/v1/recipe/apply', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: 'PoB API temporarily unavailable',
          retryable: true,
        }),
      });
    });

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    // Step 2: Wait for simulation
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Click apply
    await page.locator('[data-testid="apply-tree-button"]').click();

    // Step 4: Verify error message is shown
    await expect(page.locator('[data-testid="apply-error-message"]')).toBeVisible({
      timeout: 10000,
    });

    // Step 5: Verify retry button is available
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Step 6: Remove mock and retry
    await page.unroute('**/api/v1/recipe/apply');

    // Step 7: Click retry
    await page.locator('[data-testid="retry-button"]').click();

    // Step 8: Verify retry attempt starts
    await expect(page.locator('[data-testid="apply-loading"]')).toBeVisible();
  });

  test('handles negative stat warning for tree changes', async ({ page }) => {
    /**
     * FR-041: If stat change is negative, show warning but allow user to proceed
     * (e.g., taking defensive nodes that reduce DPS)
     */

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    // Step 2: Wait for simulation
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Check if this change shows negative DPS
    const dpsChangeElement = page.locator('[data-testid="dps-delta"]');
    const dpsChangeText = await dpsChangeElement.textContent();

    if (dpsChangeText?.includes('-')) {
      // Step 4: Verify warning is shown
      await expect(page.locator('[data-testid="negative-stat-warning"]')).toBeVisible();

      // Step 5: Verify explanation for the tradeoff
      await expect(page.locator('[data-testid="stat-tradeoff-explanation"]')).toBeVisible();

      // Step 6: Verify "Apply Anyway" option
      await expect(page.locator('[data-testid="apply-anyway-button"]')).toBeVisible();

      // Step 7: Click "Apply Anyway"
      await page.locator('[data-testid="apply-anyway-button"]').click();

      // Step 8: Verify apply proceeds
      await expect(page.locator('[data-testid="completion-overlay"]')).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test('displays ascendancy node recommendations correctly', async ({ page }) => {
    /**
     * Test that ascendancy nodes are handled correctly
     * (Ascendancy points are separate from regular passive points)
     */

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    // Step 2: Wait for simulation
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Check if ascendancy changes are included
    const ascendancyChanges = page.locator('[data-testid="ascendancy-change"]');

    if ((await ascendancyChanges.count()) > 0) {
      // Step 4: Verify ascendancy nodes are shown separately
      await expect(page.locator('[data-testid="ascendancy-section"]')).toBeVisible();

      // Step 5: Verify ascendancy point cost is shown separately
      await expect(page.locator('[data-testid="ascendancy-points-cost"]')).toBeVisible();

      // Step 6: Verify ascendancy class is displayed
      await expect(page.locator('[data-testid="ascendancy-class"]')).toBeVisible();
    }
  });

  test('persists tree card state across page refresh', async ({ page }) => {
    /**
     * FR-004: Card expansion state persists using session storage
     */

    // Step 1: Expand a tree card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 2: Refresh the page
    await page.reload();

    // Step 3: Wait for app to reload and navigate to Tree pathway
    await expect(page.locator('[data-testid="pathway-cards"]')).toBeVisible({
      timeout: 30000,
    });
    await page.locator('[data-testid="pathway-tab-tree"]').click();

    // Step 4: Verify card is still expanded
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();
  });

  test('updates build tracker after tree apply', async ({ page }) => {
    /**
     * FR-050: Track all applied improvements with stat deltas
     * FR-051: Display cumulative impact across all changes
     */

    // Step 1: Note initial build tracker state
    const initialTrackerText = await page.locator('[data-testid="build-tracker"]').textContent();

    // Step 2: Apply tree change
    await page.locator('[data-testid="improvement-card-tree"]').first().click();
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();
    await page.locator('[data-testid="apply-tree-button"]').click();

    // Step 3: Wait for completion
    await expect(page.locator('[data-testid="completion-overlay"]')).toBeVisible({
      timeout: 15000,
    });

    // Step 4: Verify build tracker updated
    const updatedTrackerText = await page.locator('[data-testid="build-tracker"]').textContent();
    expect(updatedTrackerText).not.toEqual(initialTrackerText);

    // Step 5: Verify change history shows the tree change
    await page.locator('[data-testid="view-change-history"]').click();
    await expect(page.locator('[data-testid="change-history-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="change-history-item"]').first()).toContainText(/tree|passive|node/i);
  });

  test('shows respec cost for node refunds', async ({ page }) => {
    /**
     * Test that respec (regret orb) costs are shown for node deallocations
     */

    // Step 1: Click tree improvement card
    await page.locator('[data-testid="improvement-card-tree"]').first().click();

    // Step 2: Wait for simulation
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

    // Step 3: Check if refunds are included
    const pointsToRefund = page.locator('[data-testid="points-to-refund"]');
    const refundText = await pointsToRefund.textContent();

    if (refundText && parseInt(refundText) > 0) {
      // Step 4: Verify respec cost is shown
      await expect(page.locator('[data-testid="respec-cost"]')).toBeVisible();

      // Step 5: Verify respec cost shows regret orb equivalent
      await expect(page.locator('[data-testid="respec-cost"]')).toContainText(/regret|orb/i);
    }
  });

  test('single card expansion - only one card expanded at a time', async ({ page }) => {
    /**
     * FR-003: System MUST support single-card expansion
     * (only one card expanded at a time per pathway)
     */

    // Step 1: Get all tree cards
    const treeCards = page.locator('[data-testid="improvement-card-tree"]');
    const cardCount = await treeCards.count();

    if (cardCount >= 2) {
      // Step 2: Click first tree card
      await treeCards.first().click();
      await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();

      // Step 3: Click second tree card
      await treeCards.nth(1).click();

      // Step 4: Verify only one simulation panel is visible
      const visiblePanels = page.locator('[data-testid="tree-simulation-panel"]');
      await expect(visiblePanels).toHaveCount(1);

      // Step 5: Verify first card is no longer expanded (collapsed)
      // The simulation panel should now be associated with the second card
    }
  });
});
