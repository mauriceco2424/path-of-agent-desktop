/**
 * TreeFullscreenModal Component
 *
 * Fullscreen modal for displaying the interactive passive skill tree.
 * Provides an immersive view with the InteractiveTreeCanvas filling the viewport.
 *
 * @module components/visualization/tree/TreeFullscreenModal
 */

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { InteractiveTreeCanvas } from './InteractiveTreeCanvas';
import useDesktopStore from '../../../store';
import type { SocketedJewelInfo } from './ui/TreeTooltip';
import type { ClusterNodeData } from '../../../store';

// ============================================================================
// Types
// ============================================================================

export interface TreeFullscreenModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Array of allocated passive node IDs */
  allocatedNodes: number[];
  /** Tree nodes granted externally, such as annoints, without path connectivity */
  grantedNodeIds?: number[];
  /** Optional additional CSS classes */
  className?: string;
  /** Character's ascendancy name for display */
  ascendancyName?: string;
  /** Map of socket node ID -> equipped jewel info */
  equippedJewels?: Map<number, SocketedJewelInfo>;
  /** Map of mastery node ID -> selected effect ID */
  masterySelections?: Record<number, number>;
  /** Cluster jewel nodes with PoB-calculated positions */
  clusterNodes?: ClusterNodeData[];
  /** Live per-build node overrides from PoB (timeless/radius-modified nodes) */
  nodeOverrides?: Record<number, {
    name: string;
    stats: string[];
    icon?: string;
    activeEffectImage?: string;
    reminderText?: string[];
  }>;
  /** Per-socket timeless jewel data: which nodes each timeless jewel transforms */
  timelessBySocket?: Record<number, {
    jewelName: string;
    conquerorLine?: string;
    transformedNodes: Array<{
      id: number;
      name: string;
      stats: string[];
      originalName?: string;
    }>;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const HEADER_HEIGHT = 56; // px

// ============================================================================
// Component
// ============================================================================

/**
 * TreeFullscreenModal - Fullscreen overlay for the passive skill tree
 */
export function TreeFullscreenModal({
  isOpen,
  onClose,
  allocatedNodes,
  grantedNodeIds,
  className,
  ascendancyName,
  equippedJewels,
  masterySelections,
  clusterNodes,
  nodeOverrides,
  timelessBySocket,
}: TreeFullscreenModalProps) {
  const treeDiffNodes = useDesktopStore((s) => s.treeDiffNodes);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT : 1024,
  });

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - HEADER_HEIGHT,
      });
    };

    // Set initial dimensions
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-[9999]',
        'bg-black/95',
        'flex flex-col', // Stack header and main vertically
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Passive Skill Tree Fullscreen View"
    >
      {/* Header bar */}
      <header
        className={cn(
          'flex items-center justify-between px-4 sm:px-6',
          'h-14 bg-slate-900/95',
          'border-b border-slate-700/60'
        )}
        style={{ height: HEADER_HEIGHT }}
      >
        {/* Left: Title and badge */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">
            Passive Skill Tree
          </h2>
          {ascendancyName && (
            <span
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium',
                'bg-amber-500/15 text-amber-400',
                'border border-amber-500/30'
              )}
            >
              {ascendancyName}
            </span>
          )}
        </div>

        {/* Center: Diff legend */}
        {treeDiffNodes && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-slate-800/80 border border-slate-700/60">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
                {treeDiffNodes.added.length} added
              </span>
              <span className="w-px h-3.5 bg-slate-600" />
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80 shadow-[0_0_6px_rgba(248,113,113,0.4)]" />
                {treeDiffNodes.removed.length} removed
              </span>
            </div>
            <button
              onClick={() => useDesktopStore.getState().setTreeDiffNodes(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear diff
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Close button */}
          <button
            onClick={onClose}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-md',
              'text-slate-400 hover:text-slate-100',
              'bg-slate-800/60 border border-slate-700/50',
              'hover:bg-slate-700/60 hover:border-slate-500',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/50'
            )}
            title="Close (ESC)"
            aria-label="Close fullscreen tree view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content: Interactive tree canvas */}
      <main
        className="relative flex-1 overflow-hidden"
      >
        <InteractiveTreeCanvas
          width={dimensions.width}
          height={dimensions.height}
          allocatedNodes={allocatedNodes}
          grantedNodeIds={grantedNodeIds}
          ascendancyName={ascendancyName}
          showControls={true}
          controlsPosition="bottom-right"
          equippedJewels={equippedJewels}
          masterySelections={masterySelections}
          clusterNodes={clusterNodes}
          nodeOverrides={nodeOverrides}
          timelessBySocket={timelessBySocket}
        />
      </main>
    </div>
  );

  // Use portal to render at document.body level, escaping any parent overflow constraints
  return createPortal(modalContent, document.body);
}

export default TreeFullscreenModal;
