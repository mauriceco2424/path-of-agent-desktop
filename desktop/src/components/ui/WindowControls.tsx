/**
 * WindowControls Component - Custom Forge-Themed Window Controls
 *
 * Provides minimize, maximize/restore, and close buttons for frameless Tauri windows.
 * Styled to match the dark fantasy forge aesthetic with amber/gold accents.
 *
 * @module desktop/src/components/ui/WindowControls
 */

import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    // Check initial maximized state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for window resize to update maximized state
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  const buttonBase = cn(
    'group relative flex items-center justify-center',
    'w-[46px] h-10 transition-all duration-200',
    'hover:bg-amber-500/10',
    'active:scale-95'
  );

  const iconBase = 'w-4 h-4 transition-all duration-200';

  // Stop drag region from capturing button clicks
  const handleButtonClick = (
    e: React.MouseEvent,
    action: () => void
  ) => {
    e.stopPropagation();
    e.preventDefault();
    action();
  };

  return (
    <div
      className="flex items-center -mr-2"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Minimize */}
      <button
        onClick={(e) => handleButtonClick(e, handleMinimize)}
        onMouseDown={(e) => e.stopPropagation()}
        className={buttonBase}
        aria-label="Minimize"
      >
        <Minus
          className={cn(
            iconBase,
            'text-amber-500/50 group-hover:text-amber-400',
            'group-hover:drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
          )}
        />
      </button>

      {/* Maximize/Restore */}
      <button
        onClick={(e) => handleButtonClick(e, handleMaximize)}
        onMouseDown={(e) => e.stopPropagation()}
        className={buttonBase}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <Copy
            className={cn(
              iconBase,
              'scale-75',
              'text-amber-500/50 group-hover:text-amber-400',
              'group-hover:drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
            )}
          />
        ) : (
          <Square
            className={cn(
              iconBase,
              'scale-[0.65]',
              'text-amber-500/50 group-hover:text-amber-400',
              'group-hover:drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
            )}
          />
        )}
      </button>

      {/* Close - rose/red danger styling */}
      <button
        onClick={(e) => handleButtonClick(e, handleClose)}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(buttonBase, 'hover:bg-rose-500/20 rounded-tr-lg')}
        aria-label="Close"
      >
        <X
          className={cn(
            iconBase,
            'text-amber-500/50 group-hover:text-rose-400',
            'group-hover:drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]'
          )}
        />
      </button>
    </div>
  );
}

export default WindowControls;
