/**
 * Pathway State Slice
 *
 * Zustand store for managing pathway state in the desktop app.
 * Tracks pending changes count and expanded item state.
 *
 * This slice works alongside the main desktop store to manage the
 * guided pathway UI state.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PathwayType } from '../../../shared/types/pathway';

// ============================================
// Type Definitions
// ============================================

/**
 * Pathway state
 */
export interface PathwayState {
  /** Currently expanded item ID (only one can be expanded at a time) */
  expandedItemId: string | null;

  /** Number of changes pending export */
  pendingChangesCount: number;
}

/**
 * Pathway actions
 */
export interface PathwayActions {
  /**
   * Expand an item (collapses any currently expanded item)
   */
  expandItem: (itemId: string) => void;

  /**
   * Collapse the currently expanded item
   */
  collapseItem: () => void;

  /**
   * Increment pending changes count
   */
  incrementPendingChanges: () => void;

  /**
   * Reset pending changes count (after export)
   */
  resetPendingChanges: () => void;

  /**
   * Clear all pathway state (when switching builds)
   */
  clearPathwayState: () => void;

  /**
   * Reset all state
   */
  reset: () => void;
}

export type PathwayStore = PathwayState & PathwayActions;

// ============================================
// Initial State
// ============================================

const initialState: PathwayState = {
  expandedItemId: null,
  pendingChangesCount: 0,
};

// ============================================
// Store Implementation
// ============================================

/**
 * Pathway Zustand store with localStorage persistence
 */
export const usePathwayStore = create<PathwayStore>()(
  persist(
    (set) => ({
      ...initialState,

      // Expand an item
      expandItem: (itemId) => {
        set({ expandedItemId: itemId });
      },

      // Collapse the currently expanded item
      collapseItem: () => {
        set({ expandedItemId: null });
      },

      // Increment pending changes
      incrementPendingChanges: () => {
        set((state) => ({
          pendingChangesCount: state.pendingChangesCount + 1,
        }));
      },

      // Reset pending changes
      resetPendingChanges: () => {
        set({ pendingChangesCount: 0 });
      },

      // Clear pathway state
      clearPathwayState: () => {
        set({
          expandedItemId: null,
          pendingChangesCount: 0,
        });
      },

      // Reset all state
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'poa-pathway-store',
      storage: createJSONStorage(() => localStorage),
      // Persist everything except expandedItemId (should collapse on reload)
      partialize: (state) => ({
        pendingChangesCount: state.pendingChangesCount,
      }),
    }
  )
);

export default usePathwayStore;
