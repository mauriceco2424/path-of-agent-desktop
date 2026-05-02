/**
 * AnalysisHistoryBar Component
 *
 * Thin panel above analysis content showing analysis session tabs.
 * Only shown when there are 2+ analysis entries.
 * Allows users to switch between different analysis sessions.
 *
 * Styling matches the right panel tabs (Gear | Skills | Tree) for visual consistency.
 */

import { X, Shield, Gem, TreePine, MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AnalysisEntry } from '../../store';

export interface AnalysisHistoryBarProps {
  /** Array of analysis entries */
  entries: AnalysisEntry[];
  /** ID of the currently active entry */
  activeEntryId: string | null;
  /** Callback when an entry tab is clicked */
  onSelectEntry: (id: string) => void;
  /** Callback when close button is clicked on an entry */
  onRemoveEntry: (id: string) => void;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Get icon for a focus area
 */
function FocusIcon({ focus }: { focus: 'skills' | 'gear' | 'tree' | 'qa' }) {
  switch (focus) {
    case 'gear':
      return <Shield className="w-4 h-4" />;
    case 'skills':
      return <Gem className="w-4 h-4" />;
    case 'tree':
      return <TreePine className="w-4 h-4" />;
    case 'qa':
      return <MessageCircle className="w-4 h-4" />;
  }
}

/**
 * Single tab button for an analysis entry
 * Styled to match right panel tabs (metallic forge aesthetic)
 */
function AnalysisTab({
  entry,
  isActive,
  onSelect,
  onRemove,
}: {
  entry: AnalysisEntry;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative group flex items-center gap-2 px-4 py-3 text-sm font-display font-medium tracking-wide',
        'transition-all duration-200',
        isActive
          ? 'text-amber-300 tab-metallic-active'
          : 'text-slate-400 tab-metallic hover:text-slate-200'
      )}
    >
      {/* Focus area icons (filter out synthesis — not a user-selectable focus) */}
      <span className="relative z-10 flex items-center gap-1">
        {entry.focus.filter((f): f is 'skills' | 'gear' | 'tree' | 'qa' => f === 'skills' || f === 'gear' || f === 'tree' || f === 'qa').map((f) => (
          <FocusIcon key={f} focus={f} />
        ))}
      </span>

      {/* Label */}
      <span className="relative z-10">{entry.label}</span>

      {/* Close button - visible on hover */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          'relative z-10 p-0.5 rounded ml-1',
          'opacity-0 group-hover:opacity-100',
          'hover:bg-slate-700/50 text-slate-500 hover:text-slate-300',
          'transition-opacity duration-150'
        )}
        title="Remove analysis"
      >
        <X className="w-3 h-3" />
      </span>
    </button>
  );
}

export function AnalysisHistoryBar({
  entries,
  activeEntryId,
  onSelectEntry,
  onRemoveEntry,
  className,
}: AnalysisHistoryBarProps) {
  // Only render if 2+ entries (single entry doesn't need tabs)
  if (entries.length < 2) {
    return null;
  }

  return (
    <div className={cn('flex panel-header relative', className)}>
      {/* Decorative top border - matching right panel */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      {/* Analysis tabs */}
      {entries.map((entry) => (
        <AnalysisTab
          key={entry.id}
          entry={entry}
          isActive={entry.id === activeEntryId}
          onSelect={() => onSelectEntry(entry.id)}
          onRemove={() => onRemoveEntry(entry.id)}
        />
      ))}
    </div>
  );
}

export default AnalysisHistoryBar;
