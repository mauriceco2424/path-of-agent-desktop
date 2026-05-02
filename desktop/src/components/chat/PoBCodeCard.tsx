/**
 * PoBCodeCard Component
 *
 * Provides actions to copy or open a PoB code in Path of Building.
 *
 * This component is rendered contextually when the LLM provides
 * a PoB code in its response (e.g., after making build changes).
 *
 * Features:
 * - Copy PoB code to clipboard
 * - "Open in Path of Building" button using Tauri IPC
 * - Loading state while opening in PoB
 * - Error handling with toast notifications
 *
 * Note: The actual PoB code string is NOT displayed (it's thousands of
 * characters of base64). Users interact via Copy/Open buttons only.
 */

import { useState, useCallback } from 'react';
import { Copy, Check, Hammer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { shareBuildAndOpenInPoB, TauriApiError } from '../../services/tauri-api';
import { cn } from '../../lib/utils';

export interface PoBCodeCardProps {
  /** The PoB code to display */
  pobCode: string;
  /** Optional pre-generated share URL */
  shareUrl?: string;
  /** Card title, e.g., "Your Updated Build" */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card component for displaying PoB codes with copy and open actions.
 */
export function PoBCodeCard({
  pobCode,
  shareUrl,
  title = 'Updated Build Code',
  className,
}: PoBCodeCardProps) {
  const [isOpeningInPoB, setIsOpeningInPoB] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Copy PoB code to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pobCode);
      setIsCopied(true);
      toast.success('PoB code copied to clipboard');
      // Reset the copied state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  }, [pobCode]);

  // Open the build in Path of Building
  const handleOpenInPoB = useCallback(async () => {
    if (isOpeningInPoB) return;

    setIsOpeningInPoB(true);
    try {
      await shareBuildAndOpenInPoB(pobCode);
      toast.success('Opening build in Path of Building...');
    } catch (error) {
      if (error instanceof TauriApiError && error.code === 'POB_NOT_FOUND') {
        toast.error('Path of Building is not installed. Please install PoB to use this feature.');
      } else {
        const message = error instanceof Error ? error.message : 'Failed to open in PoB';
        toast.error(message);
      }
      console.error('Open in PoB error:', error);
    } finally {
      setIsOpeningInPoB(false);
    }
  }, [pobCode, isOpeningInPoB]);

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-500/30 bg-slate-900/80 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hammer className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-200">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium',
                'bg-slate-700/50 border border-slate-600/50',
                'hover:bg-slate-600/50 hover:border-slate-500/50',
                'transition-all duration-200',
                isCopied && 'bg-green-900/30 border-green-600/50 text-green-400'
              )}
              title="Copy PoB code to clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Open in PoB button */}
            <button
              onClick={handleOpenInPoB}
              disabled={isOpeningInPoB}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium',
                'bg-amber-500/20 border border-amber-500/30 text-amber-300',
                'hover:bg-amber-500/30 hover:border-amber-400/50 hover:text-amber-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200'
              )}
              title="Open this build in Path of Building"
            >
              {isOpeningInPoB ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Opening...</span>
                </>
              ) : (
                <>
                  <Hammer className="w-3.5 h-3.5" />
                  <span>Open in PoB</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>


      {/* Optional share URL display */}
      {shareUrl && (
        <div className="px-4 py-2 border-t border-slate-700/30 bg-slate-800/30">
          <p className="text-xs text-slate-500">
            Share URL:{' '}
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400/70 hover:text-amber-400 underline"
            >
              {shareUrl}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

export default PoBCodeCard;
