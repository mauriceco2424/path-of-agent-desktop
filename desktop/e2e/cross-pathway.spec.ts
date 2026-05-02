/**
 * Cross-Pathway Integration E2E Test
 *
 * Tests all three pathways together in sequence to verify:
 * - Tree changes apply correctly
 * - Skills changes apply correctly
 * - Gear changes apply correctly
 * - Cumulative build tracking works across pathways
 *
 * Task: T074
 * FR: SC-006 (Cumulative build tracking)
 */

import { test, expect } from '@playwright/test';

test.describe('Cross-Pathway Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and import a test build
    await page.goto('http://localhost:5173');
    // Wait for initial analysis to complete
    await page.waitForSelector('[data-testid="analysis-panel"]', { timeout: 30000 });
  });

  test.skip('apply changes across all pathways and verify cumulative tracking', async ({ page }) => {
    // This test requires a running backend and PoB container
    // Skip in CI until test infrastructure is set up

    // Step 1: Apply a tree change
    await page.click('[data-testid="pathway-tab-tree"]');
    await page.waitForSelector('[data-testid="action-item"]');

    // Click first tree improvement card
    const treeCard = page.locator('[data-testid="action-item"]').first();
    await treeCard.click();

    // Wait for tree simulation panel
    await page.waitForSelector('[data-testid="tree-simulation-panel"]');

    // Click Apply Changes
    await page.click('button:has-text("Apply Changes")');

    // Wait for completion
    await page.waitForSelector('[data-testid="completion-overlay"]');

    // Verify card is marked complete
    await expect(treeCard.locator('[data-testid="completion-overlay"]')).toBeVisible();

    // Step 2: Apply a skills change
    await page.click('[data-testid="pathway-tab-skills"]');
    await page.waitForSelector('[data-testid="action-item"]');

    // Click first skills improvement card
    const skillsCard = page.locator('[data-testid="action-item"]').first();
    await skillsCard.click();

    // Wait for skills details panel
    await page.waitForSelector('[data-testid="skills-details-panel"]');

    // Click Apply to PoB
    await page.click('button:has-text("Apply to PoB")');

    // Wait for completion
    await page.waitForSelector('[data-testid="completion-overlay"]');

    // Verify card is marked complete
    await expect(skillsCard.locator('[data-testid="completion-overlay"]')).toBeVisible();

    // Step 3: Apply a gear change (via trade flow)
    await page.click('[data-testid="pathway-tab-gear"]');
    await page.waitForSelector('[data-testid="action-item"]');

    // Click first gear improvement card
    const gearCard = page.locator('[data-testid="action-item"]').first();
    await gearCard.click();

    // Select Trade path
    await page.click('button:has-text("Trade")');

    // Configure trade search
    await page.waitForSelector('[data-testid="trade-config-panel"]');
    await page.click('button:has-text("Search Trade")');

    // Wait for trade results
    await page.waitForSelector('[data-testid="trade-results-panel"]');

    // Click "Apply Purchased Item"
    await page.click('button:has-text("Apply Purchased Item")');

    // ItemPasteModal opens
    await page.waitForSelector('[data-testid="item-paste-modal"]');

    // Paste test item text
    const testItemText = `Rarity: Rare
Test Helmet
Eternal Burgonet
--------
Quality: +20%
Armour: 712
--------
+92 to maximum Life
+43% to Fire Resistance
+38% to Cold Resistance
+35% to Lightning Resistance`;

    await page.fill('textarea', testItemText);

    // Wait for validation
    await page.waitForSelector('[data-testid="validation-success"]');

    // Click Apply to PoB
    await page.click('button:has-text("Apply to PoB")');

    // Wait for completion
    await page.waitForSelector('[data-testid="completion-overlay"]');

    // Step 4: Verify cumulative tracking
    // Check build tracker panel shows all changes
    await expect(page.locator('[data-testid="build-tracker-panel"]')).toBeVisible();

    // Verify cumulative DPS change is shown
    await expect(page.locator('[data-testid="cumulative-dps"]')).toBeVisible();

    // Verify cumulative EHP change is shown
    await expect(page.locator('[data-testid="cumulative-ehp"]')).toBeVisible();
  });

  test.skip('session storage persists across refresh', async ({ page }) => {
    // This test verifies session storage persistence

    // Apply a change first
    await page.click('[data-testid="pathway-tab-tree"]');
    await page.waitForSelector('[data-testid="action-item"]');

    const treeCard = page.locator('[data-testid="action-item"]').first();
    await treeCard.click();

    // Expand card
    await page.waitForSelector('[data-testid="tree-simulation-panel"]');

    // Refresh the page
    await page.reload();

    // Wait for app to load
    await page.waitForSelector('[data-testid="analysis-panel"]');

    // Verify the card is still expanded (state persisted)
    await expect(page.locator('[data-testid="tree-simulation-panel"]')).toBeVisible();
  });

  test.skip('session storage clears on new tab', async ({ page, context }) => {
    // This test verifies session storage clears on new tab

    // Apply a change
    await page.click('[data-testid="pathway-tab-tree"]');
    await page.waitForSelector('[data-testid="action-item"]');

    const treeCard = page.locator('[data-testid="action-item"]').first();
    await treeCard.click();

    // Open a new tab
    const newPage = await context.newPage();
    await newPage.goto('http://localhost:5173');

    // Wait for app to load
    await newPage.waitForSelector('[data-testid="analysis-panel"]');

    // Navigate to tree pathway
    await newPage.click('[data-testid="pathway-tab-tree"]');
    await newPage.waitForSelector('[data-testid="action-item"]');

    // Verify no card is expanded (fresh state)
    await expect(newPage.locator('[data-testid="tree-simulation-panel"]')).not.toBeVisible();
  });
});
