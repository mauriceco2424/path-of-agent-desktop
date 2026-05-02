/**
 * Hook for managing PoE account name history with localStorage persistence.
 * Provides autocomplete suggestions for the account import field.
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'poa-account-history';
const MAX_HISTORY = 10;

export interface UseAccountHistoryReturn {
  /** Array of previously used account names, most recent first */
  history: string[];
  /** Add an account name to history (deduplicates and moves to front) */
  addToHistory: (accountName: string) => void;
  /** Remove a specific account from history */
  removeFromHistory: (accountName: string) => void;
  /** Clear all history */
  clearHistory: () => void;
}

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Silently fail on storage errors
  }
}

export function useAccountHistory(): UseAccountHistoryReturn {
  const [history, setHistory] = useState<string[]>(loadHistory);

  // Sync with localStorage on external changes (multi-tab support)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setHistory(loadHistory());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addToHistory = useCallback((accountName: string) => {
    const trimmed = accountName.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      // Remove if exists (to move to front)
      const filtered = prev.filter(
        (name) => name.toLowerCase() !== trimmed.toLowerCase()
      );
      // Add to front, limit to MAX_HISTORY
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((accountName: string) => {
    setHistory((prev) => {
      const updated = prev.filter(
        (name) => name.toLowerCase() !== accountName.toLowerCase()
      );
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addToHistory, removeFromHistory, clearHistory };
}
