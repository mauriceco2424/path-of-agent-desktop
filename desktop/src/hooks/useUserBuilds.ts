/**
 * useUserBuilds Hook
 *
 * Custom React hook for managing user-created builds in browser localStorage.
 * Handles persistence, storage limits, and CRUD operations for saved builds.
 *
 * Storage key: 'poa-user-builds'
 * Max builds: 20
 * Storage limit: 5MB (typical localStorage limit)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UserSavedBuild, UserBuildStorage } from '../../../shared/types/builds';

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'poa-user-builds';
const STORAGE_VERSION = '1.0.0';
const MAX_BUILDS = 20;
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB
const WARNING_THRESHOLD = 0.8; // Warn at 80% capacity

// =============================================================================
// Types
// =============================================================================

export interface UseUserBuildsReturn {
  /** Current list of saved builds */
  savedBuilds: UserSavedBuild[];

  /** Save a new build to storage */
  saveBuild: (build: UserSavedBuild) => SaveResult;

  /** Update an existing build by ID */
  updateBuild: (id: string, updates: Partial<UserSavedBuild>) => boolean;

  /** Delete a build by ID */
  deleteBuild: (id: string) => boolean;

  /** Get a specific build by ID */
  getBuild: (id: string) => UserSavedBuild | undefined;

  /** Clear all saved builds */
  clearAllBuilds: () => void;

  /** Loading state during initialization */
  isLoading: boolean;

  /** Current storage usage in bytes */
  storageUsed: number;

  /** Maximum storage limit in bytes */
  storageLimit: number;

  /** Whether storage is near capacity (>80%) */
  isStorageWarning: boolean;

  /** Error message if any operation failed */
  error: string | null;
}

export interface SaveResult {
  success: boolean;
  error?: string;
  trimmedFullBuild?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate the byte size of a string (UTF-8 encoding)
 */
function getByteSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Create a default empty storage object
 */
function createEmptyStorage(): UserBuildStorage {
  return {
    version: STORAGE_VERSION,
    builds: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Safely parse storage data from localStorage
 */
function parseStorageData(data: string | null): UserBuildStorage {
  if (!data) {
    return createEmptyStorage();
  }

  try {
    const parsed = JSON.parse(data) as unknown;

    // Validate parsed data is an object
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('[useUserBuilds] Invalid storage data type, resetting');
      return createEmptyStorage();
    }

    // Safely extract and validate properties
    const storageData = parsed as Record<string, unknown>;

    // Validate builds array exists
    if (!storageData.builds || !Array.isArray(storageData.builds)) {
      console.warn('[useUserBuilds] Invalid storage structure, resetting');
      return createEmptyStorage();
    }

    // Construct validated storage object
    const validatedStorage: UserBuildStorage = {
      version: typeof storageData.version === 'string' ? storageData.version : STORAGE_VERSION,
      builds: storageData.builds as UserSavedBuild[],
      lastUpdated: typeof storageData.lastUpdated === 'number' ? storageData.lastUpdated : Date.now(),
    };

    // Migration: check version and migrate if needed
    if (validatedStorage.version !== STORAGE_VERSION) {
      console.log(`[useUserBuilds] Migrating from version ${validatedStorage.version} to ${STORAGE_VERSION}`);
      // For now, just update version - add migration logic as needed
      validatedStorage.version = STORAGE_VERSION;
    }

    return validatedStorage;
  } catch (err) {
    console.error('[useUserBuilds] Corrupted storage data:', err);
    return createEmptyStorage();
  }
}

/**
 * Trim fullBuild data from a build to save space
 */
function trimBuild(build: UserSavedBuild): UserSavedBuild {
  const { fullBuild, ...trimmed } = build;
  return trimmed;
}

/**
 * Estimate storage size for a build
 */
function estimateBuildSize(build: UserSavedBuild): number {
  return getByteSize(JSON.stringify(build));
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing user-created builds in localStorage.
 *
 * Features:
 * - Automatic persistence on changes
 * - Storage limit handling (max 20 builds, 5MB)
 * - Full build data trimming when storage is tight
 * - Loading state during initialization
 * - Storage usage tracking
 */
export function useUserBuilds(): UseUserBuildsReturn {
  // State
  const [storage, setStorage] = useState<UserBuildStorage>(createEmptyStorage);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===========================================
  // Initialization: Load from localStorage
  // ===========================================

  useEffect(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const parsed = parseStorageData(data);
      setStorage(parsed);
    } catch (err) {
      console.error('[useUserBuilds] Failed to load from localStorage:', err);
      setError('Failed to load saved builds');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ===========================================
  // Persistence: Save to localStorage on changes
  // ===========================================

  useEffect(() => {
    // Don't persist during initial load
    if (isLoading) return;

    try {
      const serialized = JSON.stringify(storage);
      localStorage.setItem(STORAGE_KEY, serialized);
      setError(null);
    } catch (err) {
      // Handle quota exceeded error
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.error('[useUserBuilds] Storage quota exceeded');
        setError('Storage quota exceeded. Please delete some builds.');
      } else {
        console.error('[useUserBuilds] Failed to save to localStorage:', err);
        setError('Failed to save builds');
      }
    }
  }, [storage, isLoading]);

  // ===========================================
  // Computed Values
  // ===========================================

  const storageUsed = useMemo(() => {
    try {
      const serialized = JSON.stringify(storage);
      return getByteSize(serialized);
    } catch {
      return 0;
    }
  }, [storage]);

  const isStorageWarning = useMemo(() => {
    return storageUsed > STORAGE_LIMIT_BYTES * WARNING_THRESHOLD;
  }, [storageUsed]);

  // ===========================================
  // CRUD Operations
  // ===========================================

  /**
   * Save a new build to storage
   */
  const saveBuild = useCallback((build: UserSavedBuild): SaveResult => {
    // Check build limit
    if (storage.builds.length >= MAX_BUILDS) {
      return {
        success: false,
        error: `Maximum of ${MAX_BUILDS} builds reached. Please delete a build first.`,
      };
    }

    // Check if build with same ID already exists
    const existingIndex = storage.builds.findIndex((b) => b.id === build.id);
    if (existingIndex !== -1) {
      return {
        success: false,
        error: 'A build with this ID already exists. Use updateBuild instead.',
      };
    }

    // Estimate new storage size
    const buildSize = estimateBuildSize(build);
    const projectedSize = storageUsed + buildSize;
    let buildToSave = build;
    let trimmedFullBuild = false;

    // If storage would exceed limit, try trimming fullBuild data
    if (projectedSize > STORAGE_LIMIT_BYTES) {
      if (build.fullBuild) {
        buildToSave = trimBuild(build);
        trimmedFullBuild = true;
        const trimmedSize = estimateBuildSize(buildToSave);
        const newProjectedSize = storageUsed + trimmedSize;

        if (newProjectedSize > STORAGE_LIMIT_BYTES) {
          return {
            success: false,
            error: 'Storage limit exceeded. Please delete some builds to make room.',
          };
        }
      } else {
        return {
          success: false,
          error: 'Storage limit exceeded. Please delete some builds to make room.',
        };
      }
    }

    // Add the build
    setStorage((prev) => ({
      ...prev,
      builds: [...prev.builds, buildToSave],
      lastUpdated: Date.now(),
    }));

    return {
      success: true,
      trimmedFullBuild,
    };
  }, [storage.builds.length, storageUsed]);

  /**
   * Update an existing build by ID
   */
  const updateBuild = useCallback((id: string, updates: Partial<UserSavedBuild>): boolean => {
    const existingIndex = storage.builds.findIndex((b) => b.id === id);
    if (existingIndex === -1) {
      console.warn(`[useUserBuilds] Build not found for update: ${id}`);
      return false;
    }

    setStorage((prev) => {
      const newBuilds = [...prev.builds];
      const existingBuild = newBuilds[existingIndex];

      // Merge updates, ensuring id cannot be changed
      const updatedBuild: UserSavedBuild = {
        ...existingBuild,
        ...updates,
        id: existingBuild.id, // Preserve original ID
        updatedAt: Date.now(),
      };

      newBuilds[existingIndex] = updatedBuild;

      return {
        ...prev,
        builds: newBuilds,
        lastUpdated: Date.now(),
      };
    });

    return true;
  }, [storage.builds]);

  /**
   * Delete a build by ID
   */
  const deleteBuild = useCallback((id: string): boolean => {
    const existingIndex = storage.builds.findIndex((b) => b.id === id);
    if (existingIndex === -1) {
      console.warn(`[useUserBuilds] Build not found for deletion: ${id}`);
      return false;
    }

    setStorage((prev) => ({
      ...prev,
      builds: prev.builds.filter((b) => b.id !== id),
      lastUpdated: Date.now(),
    }));

    return true;
  }, [storage.builds]);

  /**
   * Get a specific build by ID
   */
  const getBuild = useCallback((id: string): UserSavedBuild | undefined => {
    return storage.builds.find((b) => b.id === id);
  }, [storage.builds]);

  /**
   * Clear all saved builds
   */
  const clearAllBuilds = useCallback(() => {
    setStorage({
      version: STORAGE_VERSION,
      builds: [],
      lastUpdated: Date.now(),
    });
  }, []);

  // ===========================================
  // Return Hook Interface
  // ===========================================

  return {
    savedBuilds: storage.builds,
    saveBuild,
    updateBuild,
    deleteBuild,
    getBuild,
    clearAllBuilds,
    isLoading,
    storageUsed,
    storageLimit: STORAGE_LIMIT_BYTES,
    isStorageWarning,
    error,
  };
}

export default useUserBuilds;
