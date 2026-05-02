/**
 * Token Usage Store Slice
 *
 * Zustand slice for tracking LLM token usage in the frontend.
 * Persisted to sessionStorage (clears on tab close).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  TokenUsageEntry,
  TokenUsageSummary,
  TokenUsageTotals,
} from '../../../shared/types/TokenUsage';

// ============================================
// Type Definitions
// ============================================

/**
 * Token usage state
 */
export interface TokenState {
  /** All recorded token usage entries */
  entries: TokenUsageEntry[];
  /** Cumulative totals */
  totals: TokenUsageTotals;
  /** Whether the floating panel is visible */
  isPanelVisible: boolean;
  /** Whether panel is expanded (shows history) or collapsed (summary only) */
  isPanelExpanded: boolean;
  /** Session start timestamp */
  sessionStarted: number;
  /** Current credit balance from server (null = billing not active) */
  creditBalance: number | null;
  /** Total credits deducted this session */
  creditsUsedSession: number;
}

/**
 * Token usage actions
 */
export interface TokenActions {
  /** Add token usage from an API response */
  addTokenUsage: (summary: TokenUsageSummary) => void;
  /** Toggle panel visibility */
  togglePanel: () => void;
  /** Set panel visibility explicitly */
  setPanelVisible: (visible: boolean) => void;
  /** Toggle expanded/collapsed state */
  toggleExpanded: () => void;
  /** Clear all session data */
  clearSession: () => void;
  /** Update credit balance after receiving a credit_deduction SSE event */
  applyCreditDeduction: (creditsDeducted: number, creditsRemaining: number) => void;
  /** Set initial credit balance from account overview API */
  setCreditBalance: (balance: number) => void;
}

export type TokenStore = TokenState & TokenActions;

// ============================================
// Initial State
// ============================================

const initialTotals: TokenUsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
  costUsd: 0,
  savingsUsd: 0,
};

const initialState: TokenState = {
  entries: [],
  totals: { ...initialTotals },
  isPanelVisible: false,
  isPanelExpanded: false,
  sessionStarted: Date.now(),
  creditBalance: null,
  creditsUsedSession: 0,
};

// ============================================
// Store Implementation
// ============================================

/**
 * Token Usage Zustand store with sessionStorage persistence
 */
export const useTokenStore = create<TokenStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Add token usage from API response
      addTokenUsage: (summary: TokenUsageSummary) => {
        const state = get();
        const existingEntryIds = new Set(state.entries.map((entry) => entry.id));
        const uniqueIncomingEntries = summary.entries.filter(
          (entry) => !existingEntryIds.has(entry.id)
        );

        if (uniqueIncomingEntries.length === 0) {
          return;
        }

        // Add new entries
        const newEntries = [...state.entries, ...uniqueIncomingEntries];

        // Keep only last 100 entries to prevent memory bloat
        const trimmedEntries = newEntries.slice(-100);

        // Recalculate totals from trimmed entries to stay in sync
        const newTotals: TokenUsageTotals = trimmedEntries.reduce(
          (acc, entry) => ({
            inputTokens: acc.inputTokens + entry.inputTokens,
            outputTokens: acc.outputTokens + entry.outputTokens,
            cachedTokens: acc.cachedTokens + entry.cachedInputTokens,
            totalTokens: acc.totalTokens + entry.totalTokens,
            costUsd: acc.costUsd + entry.costUsd,
            savingsUsd: acc.savingsUsd + entry.cacheSavingsUsd,
          }),
          {
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            savingsUsd: 0,
          }
        );

        set({
          entries: trimmedEntries,
          totals: newTotals,
          // Auto-show panel on first usage (when entries were empty before)
          isPanelVisible:
            state.isPanelVisible ||
            state.entries.length === 0,
        });
      },

      // Toggle panel visibility
      togglePanel: () => {
        set((state) => ({ isPanelVisible: !state.isPanelVisible }));
      },

      // Set panel visibility explicitly
      setPanelVisible: (visible: boolean) => {
        set({ isPanelVisible: visible });
      },

      // Toggle expanded/collapsed state
      toggleExpanded: () => {
        set((state) => ({ isPanelExpanded: !state.isPanelExpanded }));
      },

      // Clear all session data
      clearSession: () => {
        set({
          entries: [],
          totals: { ...initialTotals },
          sessionStarted: Date.now(),
          creditsUsedSession: 0,
        });
      },

      // Update credit balance after receiving a credit_deduction SSE event
      applyCreditDeduction: (creditsDeducted: number, creditsRemaining: number) => {
        set((state) => ({
          creditBalance: creditsRemaining,
          creditsUsedSession: state.creditsUsedSession + creditsDeducted,
        }));
      },

      // Set initial credit balance from account overview API
      setCreditBalance: (balance: number) => {
        set({ creditBalance: balance });
      },
    }),
    {
      name: 'token-usage-storage',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist these fields
      partialize: (state) => ({
        entries: state.entries,
        totals: state.totals,
        isPanelVisible: state.isPanelVisible,
        isPanelExpanded: state.isPanelExpanded,
        sessionStarted: state.sessionStarted,
        creditBalance: state.creditBalance,
        creditsUsedSession: state.creditsUsedSession,
      }),
    }
  )
);

// ============================================
// Selector Helpers
// ============================================

/** Get total cost in USD */
export const selectTotalCost = (state: TokenStore) => state.totals.costUsd;

/** Get total tokens used */
export const selectTotalTokens = (state: TokenStore) => state.totals.totalTokens;

/** Get the 20 most recent entries */
export const selectRecentEntries = (state: TokenStore) =>
  state.entries.slice(-20);

/** Check if any usage has been recorded */
export const selectHasUsage = (state: TokenStore) => state.entries.length > 0;

/** Get current credit balance (null if billing not active) */
export const selectCreditBalance = (state: TokenStore) => state.creditBalance;

/** Get total credits used this session */
export const selectCreditsUsedSession = (state: TokenStore) => state.creditsUsedSession;

export default useTokenStore;
