/**
 * Shared utility for navigating to tool result elements by package ref.
 * Used by semantic-markdown pills and ToolStepCard nomination clicks.
 */
import { useDesktopStore } from '../store';
import type { AnalysisFocus } from '../types/chat-modes';
import type { PathwayType } from '../store';
import { useGearPackageStore } from '../store/gearPackageStore';

type PathwayTab = 'gear' | 'skills' | 'tree' | 'synthesis';

const REF_PREFIX_TO_PATHWAY: Record<string, PathwayTab> = {
  GR: 'gear',
  SK: 'skills',
  TR: 'tree',
  C: 'synthesis',
};

/**
 * Infer the pathway tab from a package ref prefix.
 * E.g. "GR1" -> 'gear', "SK2" -> 'skills', "TR3" -> 'tree', "C1-2" -> 'synthesis'
 */
export function inferPathwayFromRef(ref: string): PathwayTab | null {
  const prefix = ref.replace(/\d+$/, '').replace(/-.*$/, '').toUpperCase();
  return REF_PREFIX_TO_PATHWAY[prefix] ?? null;
}

/**
 * Navigate to a tool result element by its data-ref attribute.
 * Scrolls into view, adds a highlight ring, and dispatches an expand-items event.
 * Returns true if the element was found.
 */
export function navigateToRef(ref: string, silent = false): boolean {
  const selector = `[data-ref="${ref.toLowerCase()}"]`;
  const el = document.querySelector<HTMLElement>(selector);
  if (!silent) console.log(`[nav] navigateToRef("${ref}") selector=${selector} found=${!!el}`);
  if (!el) return false;

  const highlightTarget = el.closest<HTMLElement>('[data-tool-name]') ?? el;
  const scrollTarget = el.dataset.packageAnchor === 'true' ? highlightTarget : el;
  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  highlightTarget.classList.add('ring-2', 'ring-amber-500/60');
  setTimeout(() => highlightTarget.classList.remove('ring-2', 'ring-amber-500/60'), 2000);
  el.dispatchEvent(new CustomEvent('expand-items', { bubbles: true }));
  highlightTarget.dispatchEvent(new CustomEvent('expand-tool-step', { bubbles: true }));
  return true;
}

/**
 * Fallback: navigate to the source tool card for a package ref using registry
 * metadata when the exact row/anchor is not currently rendered.
 * Expands the tool card, then polls for the specific result row to appear.
 */
export function navigateToPackageSource(ref: string): boolean {
  const pkg = useGearPackageStore.getState().packages.get(ref.toLowerCase());
  const source = pkg?.source;
  if (!source?.toolName) return false;

  const selector = source.callNumber != null
    ? `[data-tool-name="${source.toolName}"][data-call-number="${source.callNumber}"]`
    : `[data-tool-name="${source.toolName}"]`;

  const el = document.querySelector<HTMLElement>(selector);
  console.log(`[nav] navigateToPackageSource("${ref}") selector=${selector} found=${!!el}`);
  if (!el) return false;

  // Expand the tool card (ToolActivitySummary listens for this)
  el.dispatchEvent(new CustomEvent('expand-tool-step', { bubbles: true }));

  // After the detail view renders, poll for the specific result row
  const refSelector = `[data-ref="${ref.toLowerCase()}"]`;
  let retries = 0;
  const MAX_RETRIES = 15;
  function pollForRow() {
    const row = document.querySelector<HTMLElement>(refSelector);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('ring-2', 'ring-amber-500/60');
      setTimeout(() => row.classList.remove('ring-2', 'ring-amber-500/60'), 2000);
      row.dispatchEvent(new CustomEvent('expand-items', { bubbles: true }));
      return;
    }
    retries++;
    if (retries < MAX_RETRIES) {
      requestAnimationFrame(pollForRow);
    } else if (el) {
      // Row never appeared — just scroll to the card itself
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-500/60');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500/60'), 2000);
    }
  }
  requestAnimationFrame(pollForRow);
  return true;
}

/**
 * Navigate to a ref that may be on a different pathway tab.
 * Switches the active pathway tab, then polls with requestAnimationFrame
 * until the element appears in the DOM (up to 10 retries).
 */
export function navigateToRefCrossTab(ref: string): void {
  const pathway = inferPathwayFromRef(ref);
  console.log(`[nav] navigateToRefCrossTab("${ref}") inferred pathway=${pathway}`);
  if (!pathway) return;

  const store = useDesktopStore.getState();
  console.log(`[nav] switching tab to "${pathway}" (current: "${store.activePathwayTab}")`);
  store.setActivePathwayTab(pathway as AnalysisFocus);
  if (pathway !== 'synthesis') {
    store.setActivePathway(pathway as PathwayType);
  }

  let retries = 0;
  const MAX_RETRIES = 24;

  function poll() {
    if (navigateToRef(ref, true)) {
      console.log(`[nav] cross-tab found "${ref}" after ${retries + 1} frame(s)`);
      return;
    }
    if (navigateToPackageSource(ref)) {
      console.log(`[nav] cross-tab source fallback found after ${retries + 1} frame(s)`);
      return;
    }
    retries++;
    if (retries < MAX_RETRIES) {
      requestAnimationFrame(poll);
    } else {
      console.warn(`[nav] cross-tab gave up after ${MAX_RETRIES} frames for "${ref}"`);
    }
  }

  requestAnimationFrame(poll);
}

/**
 * Infer the pathway from a tool name (used by simresult pills).
 * Maps tool names to their corresponding pathway tabs.
 */
const TOOL_NAME_TO_PATHWAY: Record<string, PathwayTab> = {
  test_gear_setups: 'gear',
  find_gear_upgrades: 'gear',
  test_skill_setup: 'skills',
  test_gem_swaps: 'skills',
  batch_simulate_tree: 'tree',
  batch_test_tree: 'tree',
  simulate_tree_changes: 'tree',
  test_combined_changes: 'synthesis',
};

export function inferPathwayFromToolName(toolName: string): PathwayTab | null {
  return TOOL_NAME_TO_PATHWAY[toolName] ?? null;
}
