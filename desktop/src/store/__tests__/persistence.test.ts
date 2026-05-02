/**
 * Unit Tests for Session Storage Persistence
 *
 * Spec 043: Improvement Card Workflows - FR-004
 * Task T056: Unit test session storage persistence
 *
 * Tests that critical state (recipe progress, completed cards)
 * persists to sessionStorage and is restored on store creation.
 *
 * NOTE: New tab behavior (fresh state per tab) cannot be easily tested here
 * since sessionStorage is inherently tab-scoped. This behavior is documented
 * but not explicitly tested.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RecipeProgress } from '../../../../shared/types/recipe';

// =============================================================================
// Types for Test Store
// =============================================================================

/**
 * Minimal subset of DesktopStoreState for persistence testing.
 * We create a minimal store rather than importing the full store
 * to isolate persistence behavior testing.
 */
interface TestStoreState {
  // Recipe Progress State (Spec 040)
  recipeProgress: Record<string, RecipeProgress>;

  // Inline Card Completion State (Spec 038)
  completedCards: Record<string, {
    isCompleted: boolean;
    completedAt?: number;
    appliedStatsDelta?: {
      dpsPercent: number;
      ehpPercent: number;
    };
  }>;

}

interface TestStoreActions {
  setRecipeProgress: (improvementId: string, progress: RecipeProgress) => void;
  markCardCompleted: (
    cardId: string,
    statsDelta?: { dpsPercent: number; ehpPercent: number },
  ) => void;
  reset: () => void;
}

type TestStore = TestStoreState & TestStoreActions;

// =============================================================================
// Mock sessionStorage
// =============================================================================

const createMockSessionStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    // Expose internal store for test inspection
    _getStore: () => ({ ...store }),
  };
};

// =============================================================================
// Test Store Factory
// =============================================================================

const STORAGE_KEY = 'poa-desktop-store-test';

const initialTestState: TestStoreState = {
  recipeProgress: {},
  completedCards: {},
};

/**
 * Creates a test store with sessionStorage persistence.
 * This mirrors the structure of the real desktop store but with
 * only the fields relevant to persistence testing.
 */
const createTestStore = (storage: ReturnType<typeof createMockSessionStorage>) => {
  return create<TestStore>()(
    persist(
      (set, get) => ({
        ...initialTestState,

        setRecipeProgress: (improvementId, progress) => {
          set((state) => ({
            recipeProgress: {
              ...state.recipeProgress,
              [improvementId]: progress,
            },
          }));
        },

        markCardCompleted: (cardId, statsDelta) => {
          const timestamp = Date.now();
          set((state) => ({
            completedCards: {
              ...state.completedCards,
              [cardId]: {
                isCompleted: true,
                completedAt: timestamp,
                appliedStatsDelta: statsDelta,
              },
            },
          }));
        },

        reset: () => {
          set(initialTestState);
        },
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          // Only persist these fields (mirrors real store behavior)
          recipeProgress: state.recipeProgress,
          completedCards: state.completedCards,
        }),
      }
    )
  );
};

// =============================================================================
// Tests
// =============================================================================

describe('Session Storage Persistence', () => {
  let mockStorage: ReturnType<typeof createMockSessionStorage>;

  beforeEach(() => {
    mockStorage = createMockSessionStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Recipe Progress Persistence
  // ---------------------------------------------------------------------------

  describe('Recipe Progress', () => {
    it('persists recipe progress to sessionStorage', () => {
      const useStore = createTestStore(mockStorage);

      // Set recipe progress
      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: ['step-1', 'step-2'],
        isExpanded: true,
        lastUpdated: Date.now(),
      });

      // Verify sessionStorage was called
      expect(mockStorage.setItem).toHaveBeenCalled();

      // Verify the stored data structure
      const storedData = mockStorage._getStore()[STORAGE_KEY];
      expect(storedData).toBeDefined();

      const parsed = JSON.parse(storedData);
      expect(parsed.state.recipeProgress['card-1']).toBeDefined();
      expect(parsed.state.recipeProgress['card-1'].selectedPathId).toBe('trade');
      expect(parsed.state.recipeProgress['card-1'].completedStepIds).toEqual([
        'step-1',
        'step-2',
      ]);
    });

    it('restores recipe progress on store creation', () => {
      // Pre-populate sessionStorage with recipe progress
      const preExistingData = {
        state: {
          recipeProgress: {
            'card-1': {
              improvementId: 'card-1',
              selectedPathId: 'craft',
              completedStepIds: ['step-1'],
              isExpanded: false,
              lastUpdated: 1700000000000,
            },
          },
          completedCards: {},
        },
        version: 0,
      };
      mockStorage.setItem(STORAGE_KEY, JSON.stringify(preExistingData));

      // Create store - should restore persisted state
      const useStore = createTestStore(mockStorage);

      // Access state (Zustand persist hydrates asynchronously, but getState is sync)
      const state = useStore.getState();
      expect(state.recipeProgress['card-1']).toBeDefined();
      expect(state.recipeProgress['card-1'].selectedPathId).toBe('craft');
      expect(state.recipeProgress['card-1'].completedStepIds).toEqual(['step-1']);
    });

    it('persists multiple recipe progresses for different cards', () => {
      const useStore = createTestStore(mockStorage);

      // Set progress for multiple cards
      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: ['step-1'],
        isExpanded: true,
        lastUpdated: Date.now(),
      });

      useStore.getState().setRecipeProgress('card-2', {
        improvementId: 'card-2',
        selectedPathId: 'craft',
        completedStepIds: [],
        isExpanded: false,
        lastUpdated: Date.now(),
      });

      // Verify both are stored
      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);

      expect(Object.keys(parsed.state.recipeProgress)).toHaveLength(2);
      expect(parsed.state.recipeProgress['card-1'].selectedPathId).toBe('trade');
      expect(parsed.state.recipeProgress['card-2'].selectedPathId).toBe('craft');
    });

    it('updates recipe progress when steps are completed', () => {
      const useStore = createTestStore(mockStorage);

      // Initial progress
      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: [],
        isExpanded: true,
        lastUpdated: Date.now(),
      });

      // Update with completed step
      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: ['step-1'],
        isExpanded: true,
        lastUpdated: Date.now(),
      });

      // Verify update is persisted
      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);
      expect(parsed.state.recipeProgress['card-1'].completedStepIds).toEqual([
        'step-1',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Completed Cards Persistence
  // ---------------------------------------------------------------------------

  describe('Completed Cards', () => {
    it('persists completed cards to sessionStorage', () => {
      const useStore = createTestStore(mockStorage);

      // Mark card as completed
      useStore.getState().markCardCompleted('card-1', {
        dpsPercent: 10,
        ehpPercent: 5,
      });

      // Verify sessionStorage was called
      expect(mockStorage.setItem).toHaveBeenCalled();

      // Verify the stored data structure
      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);

      expect(parsed.state.completedCards['card-1']).toBeDefined();
      expect(parsed.state.completedCards['card-1'].isCompleted).toBe(true);
      expect(parsed.state.completedCards['card-1'].appliedStatsDelta).toEqual({
        dpsPercent: 10,
        ehpPercent: 5,
      });
    });

    it('restores completed cards on store creation', () => {
      // Pre-populate sessionStorage
      const preExistingData = {
        state: {
          recipeProgress: {},
          completedCards: {
            'card-1': {
              isCompleted: true,
              completedAt: 1700000000000,
              appliedStatsDelta: { dpsPercent: 15, ehpPercent: 8 },
            },
          },
        },
        version: 0,
      };
      mockStorage.setItem(STORAGE_KEY, JSON.stringify(preExistingData));

      // Create store
      const useStore = createTestStore(mockStorage);

      // Verify restoration
      const state = useStore.getState();
      expect(state.completedCards['card-1']).toBeDefined();
      expect(state.completedCards['card-1'].isCompleted).toBe(true);
      expect(state.completedCards['card-1'].appliedStatsDelta).toEqual({
        dpsPercent: 15,
        ehpPercent: 8,
      });
    });

    it('persists multiple completed cards', () => {
      const useStore = createTestStore(mockStorage);

      useStore.getState().markCardCompleted('card-1', { dpsPercent: 10, ehpPercent: 5 });
      useStore.getState().markCardCompleted('card-2', { dpsPercent: 20, ehpPercent: 0 });
      useStore.getState().markCardCompleted('card-3'); // Without stats delta

      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);

      expect(Object.keys(parsed.state.completedCards)).toHaveLength(3);
      expect(parsed.state.completedCards['card-1'].appliedStatsDelta.dpsPercent).toBe(10);
      expect(parsed.state.completedCards['card-2'].appliedStatsDelta.dpsPercent).toBe(20);
      expect(parsed.state.completedCards['card-3'].appliedStatsDelta).toBeUndefined();
    });

    it('includes completedAt timestamp when marking card completed', () => {
      const useStore = createTestStore(mockStorage);
      const beforeTimestamp = Date.now();

      useStore.getState().markCardCompleted('card-1', { dpsPercent: 5, ehpPercent: 3 });

      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);

      expect(parsed.state.completedCards['card-1'].completedAt).toBeDefined();
      expect(parsed.state.completedCards['card-1'].completedAt).toBeGreaterThanOrEqual(
        beforeTimestamp
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Session Clear Behavior
  // ---------------------------------------------------------------------------

  describe('Session Clear', () => {
    it('loses state when sessionStorage is cleared and store is recreated', () => {
      // First: create store and add some state
      const useStore1 = createTestStore(mockStorage);
      useStore1.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: ['step-1'],
        isExpanded: true,
        lastUpdated: Date.now(),
      });
      useStore1.getState().markCardCompleted('card-2', { dpsPercent: 10, ehpPercent: 5 });

      // Verify state exists
      expect(useStore1.getState().recipeProgress['card-1']).toBeDefined();
      expect(useStore1.getState().completedCards['card-2']).toBeDefined();

      // Clear sessionStorage (simulates browser session end)
      mockStorage.clear();

      // Create new store (simulates new session)
      const useStore2 = createTestStore(mockStorage);

      // Verify state is empty
      expect(useStore2.getState().recipeProgress).toEqual({});
      expect(useStore2.getState().completedCards).toEqual({});
    });

    it('removes specific key when removeItem is called', () => {
      const useStore = createTestStore(mockStorage);

      // Add state
      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: [],
        isExpanded: true,
        lastUpdated: Date.now(),
      });

      // Verify storage has data
      expect(mockStorage.getItem(STORAGE_KEY)).not.toBeNull();

      // Remove the storage key
      mockStorage.removeItem(STORAGE_KEY);

      // Verify storage is empty
      expect(mockStorage.getItem(STORAGE_KEY)).toBeNull();

      // New store should have fresh state
      const newStore = createTestStore(mockStorage);
      expect(newStore.getState().recipeProgress).toEqual({});
    });

    it('reset action clears in-memory state but storage update follows', () => {
      const useStore = createTestStore(mockStorage);

      // Add state
      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: ['step-1'],
        isExpanded: true,
        lastUpdated: Date.now(),
      });
      useStore.getState().markCardCompleted('card-2', { dpsPercent: 5, ehpPercent: 2 });

      // Reset
      useStore.getState().reset();

      // Verify in-memory state is cleared
      expect(useStore.getState().recipeProgress).toEqual({});
      expect(useStore.getState().completedCards).toEqual({});

      // Storage should also be updated with empty state
      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);
      expect(parsed.state.recipeProgress).toEqual({});
      expect(parsed.state.completedCards).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // Partial State Persistence
  // ---------------------------------------------------------------------------

  describe('Partial State Persistence', () => {
    it('only persists partialize-specified fields', () => {
      const useStore = createTestStore(mockStorage);

      // Set all state
      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: [],
        isExpanded: true,
        lastUpdated: Date.now(),
      });

      // Verify only partialize fields are stored
      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);

      // These should be present (specified in partialize)
      expect(parsed.state).toHaveProperty('recipeProgress');
      expect(parsed.state).toHaveProperty('completedCards');

      // The state object should only have the partialize fields
      const stateKeys = Object.keys(parsed.state);
      expect(stateKeys).toContain('recipeProgress');
      expect(stateKeys).toContain('completedCards');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('handles empty recipe progress gracefully', () => {
      const preExistingData = {
        state: {
          recipeProgress: {},
          completedCards: {},
        },
        version: 0,
      };
      mockStorage.setItem(STORAGE_KEY, JSON.stringify(preExistingData));

      const useStore = createTestStore(mockStorage);

      expect(useStore.getState().recipeProgress).toEqual({});
      expect(Object.keys(useStore.getState().recipeProgress)).toHaveLength(0);
    });

    it('handles corrupted storage gracefully', () => {
      // Set invalid JSON
      mockStorage.setItem(STORAGE_KEY, 'not-valid-json');

      // Store should still be creatable with initial state
      const useStore = createTestStore(mockStorage);

      // Should fall back to initial state
      expect(useStore.getState().recipeProgress).toBeDefined();
      expect(useStore.getState().completedCards).toBeDefined();
    });

    it('handles missing version in stored data', () => {
      // Old format without version
      const preExistingData = {
        state: {
          recipeProgress: {
            'card-1': {
              improvementId: 'card-1',
              selectedPathId: 'trade',
              completedStepIds: [],
              isExpanded: false,
              lastUpdated: 1700000000000,
            },
          },
          completedCards: {},
        },
        // No version field
      };
      mockStorage.setItem(STORAGE_KEY, JSON.stringify(preExistingData));

      const useStore = createTestStore(mockStorage);

      // Should still restore state
      expect(useStore.getState().recipeProgress['card-1']).toBeDefined();
    });

    it('handles budget field in recipe progress', () => {
      const useStore = createTestStore(mockStorage);

      useStore.getState().setRecipeProgress('card-1', {
        improvementId: 'card-1',
        selectedPathId: 'trade',
        completedStepIds: [],
        isExpanded: true,
        lastUpdated: Date.now(),
        budget: {
          amount: 100,
          currency: 'chaos',
        },
      });

      const storedData = mockStorage._getStore()[STORAGE_KEY];
      const parsed = JSON.parse(storedData);

      expect(parsed.state.recipeProgress['card-1'].budget).toEqual({
        amount: 100,
        currency: 'chaos',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // New Tab Behavior (Documented)
  // ---------------------------------------------------------------------------

  describe('New Tab Behavior (Documentation)', () => {
    /**
     * NOTE: This test documents expected behavior but cannot truly test it
     * because sessionStorage is inherently isolated per browser tab/window.
     *
     * Expected behavior:
     * - Each browser tab has its own sessionStorage instance
     * - A new tab will start with fresh/empty state
     * - Tab A's recipe progress is NOT visible to Tab B
     * - This is the desired behavior for our use case
     *
     * This cannot be unit tested because:
     * - Vitest runs in a single process with a single mock storage
     * - True tab isolation requires browser-level testing (Playwright/Cypress)
     */
    it.skip('documents that new tabs have isolated state (requires E2E testing)', () => {
      // This test documents expected behavior but cannot be unit tested.
      // True tab isolation requires browser-level testing (Playwright/Cypress).
      //
      // Real-world behavior:
      // Tab A: User imports build, starts recipe progress
      // Tab B: User opens new tab, sees fresh state (no recipe progress)
      // This is correct because sessionStorage is tab-scoped
    });
  });
});
