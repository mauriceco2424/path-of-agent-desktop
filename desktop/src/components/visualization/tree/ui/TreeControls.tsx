/**
 * TreeControls Component
 *
 * Floating control panel for tree visualization zoom and navigation.
 * Provides buttons for zoom in/out and reset view, plus editable zoom input.
 *
 * @module components/visualization/tree/ui/TreeControls
 */

import { memo, useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import type { TreeViewportControls } from '../hooks/useTreeViewport';

// ============================================================================
// Types
// ============================================================================

export interface TreeControlsProps {
  /** Viewport control functions from useTreeViewport */
  controls: TreeViewportControls;
  /** Position of the control panel */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Additional class names for the root container */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Control button with consistent styling
 */
interface ControlButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const ControlButton = memo(function ControlButton({
  onClick,
  disabled,
  title,
  children,
  className: buttonClassName,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-md',
        'bg-slate-800/60 border border-slate-700/50',
        'text-slate-300 hover:text-amber-400',
        'hover:bg-slate-700/60 hover:border-amber-500/40',
        'transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:bg-slate-800/60 disabled:hover:border-slate-700/50',
        'focus:outline-none focus:ring-1 focus:ring-amber-500/50',
        buttonClassName
      )}
    >
      {children}
    </button>
  );
});

/**
 * TreeControls - Floating control panel for tree visualization
 */
export const TreeControls = memo(function TreeControls({
  controls,
  position = 'bottom-right',
  disabled = false,
  className,
}: TreeControlsProps) {
  const { zoomIn, zoomOut, resetView, setZoom, currentZoom, minZoom, maxZoom } = controls;
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(currentZoom));
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when currentZoom changes (from external zoom)
  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(currentZoom));
    }
  }, [currentZoom, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Position classes based on position prop
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  const isAtMinZoom = currentZoom <= minZoom;
  const isAtMaxZoom = currentZoom >= maxZoom;

  const handleZoomSubmit = () => {
    const value = parseInt(inputValue, 10);
    if (!isNaN(value) && value >= minZoom && value <= maxZoom && setZoom) {
      setZoom(value);
    } else {
      // Reset to current value if invalid
      setInputValue(String(currentZoom));
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleZoomSubmit();
    } else if (e.key === 'Escape') {
      setInputValue(String(currentZoom));
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'absolute z-10',
        positionClasses[position],
        'pointer-events-auto',
        className
      )}
    >
      {/* Main control panel */}
      <div
        className={cn(
          'flex flex-col gap-2 p-2 rounded-lg',
          'bg-slate-900/25',
          'border border-slate-700/60',
          'shadow-lg shadow-black/40'
        )}
      >
        {/* Zoom controls row */}
        <div className="flex items-center gap-1.5">
          <ControlButton
            onClick={zoomIn}
            disabled={disabled || isAtMaxZoom}
            title="Zoom in (+50%)"
          >
            <ZoomIn className="w-4 h-4" />
          </ControlButton>

          <ControlButton
            onClick={zoomOut}
            disabled={disabled || isAtMinZoom}
            title="Zoom out (-33%)"
          >
            <ZoomOut className="w-4 h-4" />
          </ControlButton>

          <ControlButton
            onClick={resetView}
            disabled={disabled}
            title="Fit tree to view"
          >
            <Maximize2 className="w-4 h-4" />
          </ControlButton>
        </div>

        {/* Editable zoom level input */}
        <div className="flex items-center">
          {isEditing ? (
            <div className="flex items-center">
              <input
                ref={inputRef}
                type="number"
                min={minZoom}
                max={maxZoom}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleZoomSubmit}
                onKeyDown={handleKeyDown}
                className={cn(
                  'w-14 h-7 px-1.5 rounded-md text-center',
                  'bg-slate-800 border border-amber-500/50',
                  'text-xs font-mono text-slate-200 tabular-nums',
                  'focus:outline-none focus:ring-1 focus:ring-amber-500/50',
                  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                )}
              />
              <span className="ml-0.5 text-xs text-slate-400">%</span>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              title="Click to set zoom level"
              className={cn(
                'flex items-center justify-center min-w-[52px] h-7 px-2 rounded-md',
                'bg-slate-800/40 border border-slate-700/40',
                'text-xs font-mono text-slate-400 tabular-nums',
                'hover:bg-slate-700/60 hover:border-amber-500/40 hover:text-amber-400',
                'transition-all duration-150 cursor-pointer',
                'disabled:cursor-not-allowed disabled:hover:bg-slate-800/40 disabled:hover:border-slate-700/40 disabled:hover:text-slate-400'
              )}
            >
              {currentZoom}%
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default TreeControls;
