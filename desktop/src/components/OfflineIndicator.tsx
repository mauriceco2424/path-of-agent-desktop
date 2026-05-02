/**
 * OfflineIndicator Component
 *
 * Shows connection status for the backend server.
 * Displays a simple icon with connection state.
 *
 * Features:
 * - Backend connection status (connected/disconnected/checking)
 * - Visual indicator with color-coded icon
 * - Click to refresh connection status
 * - Auto-refresh every 30 seconds
 */

import React, { useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useDesktopStore } from '../store';
import { checkBackendConnection } from '../services/tauri-api';

// ============================================
// Type Definitions
// ============================================

type ConnectionState = 'connected' | 'disconnected' | 'checking';

// ============================================
// Main Component
// ============================================

export interface OfflineIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Show detailed view with labels (ignored - always compact now) */
  detailed?: boolean;
}

/**
 * Connection status indicator for desktop app header
 *
 * @example
 * ```tsx
 * // In header
 * <OfflineIndicator />
 * ```
 */
export function OfflineIndicator({
  className = '',
}: OfflineIndicatorProps) {
  // Store state
  const connectionStatus = useDesktopStore((s) => s.connectionStatus);
  const setBackendStatus = useDesktopStore((s) => s.setBackendStatus);
  const updateLastChecked = useDesktopStore((s) => s.updateLastChecked);

  /**
   * Check backend connection
   */
  const checkConnection = useCallback(async () => {
    setBackendStatus('checking');
    const backendOk = await checkBackendConnection();
    setBackendStatus(backendOk ? 'connected' : 'disconnected');
    updateLastChecked();
  }, [setBackendStatus, updateLastChecked]);

  // Check connection on mount and periodically
  useEffect(() => {
    // Initial check
    checkConnection();

    // Periodic check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, [checkConnection]);

  const status: ConnectionState = connectionStatus.backend;

  // Status labels for tooltip
  const statusLabels: Record<ConnectionState, string> = {
    connected: 'Connected to backend',
    disconnected: 'Backend offline',
    checking: 'Checking connection...',
  };

  return (
    <button
      className={`p-2 rounded-lg hover:bg-slate-700/50 transition-colors ${className}`}
      onClick={checkConnection}
      title={statusLabels[status]}
      aria-label={statusLabels[status]}
    >
      {status === 'connected' ? (
        <Wifi className="w-4 h-4 text-green-500" />
      ) : status === 'checking' ? (
        <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
      ) : (
        <WifiOff className="w-4 h-4 text-red-500" />
      )}
    </button>
  );
}

export default OfflineIndicator;
