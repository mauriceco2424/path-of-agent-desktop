/**
 * AtlasTreeFullscreenModal
 *
 * Fullscreen overlay for the atlas passive tree. Reuses InteractiveTreeCanvas
 * with atlas tree data injected via treeDataOverride. Includes a collapsible
 * side panel showing allocated stats grouped by category with search.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, PanelRightOpen, PanelRightClose, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { InteractiveTreeCanvas } from '../tree/InteractiveTreeCanvas';
import { useAtlasTreeData } from './useAtlasTreeData';
import type { AtlasCategoryStat } from '../../../../../shared/types/atlas';

// ============================================================================
// Types
// ============================================================================

export interface AtlasTreeFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocatedNodes: number[];
  categoryStats?: Record<string, AtlasCategoryStat[]>;
  contentCategories?: Record<string, number>;
  /** Suggested next nodes to highlight green (from suggest_atlas_path tool). */
  diffNodes?: number[] | null;
}

const HEADER_HEIGHT = 56;
const PANEL_WIDTH = 340;

// ============================================================================
// Stats Panel
// ============================================================================

function highlightNumbers(text: string): React.ReactNode {
  const parts = text.split(/(\+?\d+%?)/g);
  return parts.map((part, i) => {
    if (/^\+?\d+%?$/.test(part)) {
      return <span key={i} className="text-sky-300 font-medium">{part}</span>;
    }
    return part;
  });
}

function StatsPanel({
  categoryStats,
  contentCategories,
  onSearchChange,
}: {
  categoryStats: Record<string, AtlasCategoryStat[]>;
  contentCategories: Record<string, number>;
  onSearchChange?: (term: string) => void;
}) {
  const [search, setSearch] = useState('');

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onSearchChange?.(value);
  };
  const [expandedCats, setExpandedCats] = useState<Set<string>>(() => new Set(Object.keys(categoryStats)));

  const sortedCategories = useMemo(() => {
    return Object.entries(contentCategories).sort(([, a], [, b]) => b - a);
  }, [contentCategories]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return sortedCategories;
    const lower = search.toLowerCase();
    return sortedCategories.filter(([name]) => {
      const stats = categoryStats[name] ?? [];
      return name.toLowerCase().includes(lower) ||
        stats.some(s => s.stat.toLowerCase().includes(lower) || s.source.toLowerCase().includes(lower));
    });
  }, [sortedCategories, categoryStats, search]);

  const toggleCat = (name: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const collapseAll = () => setExpandedCats(new Set());
  const expandAll = () => setExpandedCats(new Set(Object.keys(categoryStats)));

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search stats..."
            className={cn(
              'w-full pl-8 pr-3 py-1.5 rounded-md text-[0.6875rem]',
              'bg-slate-900/80 border border-slate-700/50',
              'text-slate-300 placeholder-slate-600',
              'focus:outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/20',
              'transition-colors duration-150',
            )}
          />
        </div>
      </div>

      {/* Collapse/Expand controls */}
      <div className="px-3 pb-2 flex-shrink-0 flex gap-2">
        <button
          onClick={collapseAll}
          className="text-[0.5625rem] text-slate-500 hover:text-slate-300 font-display uppercase tracking-widest transition-colors"
        >
          Collapse All
        </button>
        <span className="text-slate-700">|</span>
        <button
          onClick={expandAll}
          className="text-[0.5625rem] text-slate-500 hover:text-slate-300 font-display uppercase tracking-widest transition-colors"
        >
          Expand All
        </button>
      </div>

      {/* Divider */}
      <div className="h-px mx-3" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.15) 50%, transparent 100%)',
      }} />

      {/* Category list */}
      <div className="flex-1 overflow-y-auto scrollbar-fantasy px-2 py-2">
        {filteredCategories.map(([name, count]) => {
          const stats = categoryStats[name] ?? [];
          const isExpanded = expandedCats.has(name);

          // Filter individual stats if searching
          const visibleStats = search.trim()
            ? stats.filter(s =>
                s.stat.toLowerCase().includes(search.toLowerCase()) ||
                s.source.toLowerCase().includes(search.toLowerCase()) ||
                name.toLowerCase().includes(search.toLowerCase())
              )
            : stats;

          return (
            <div key={name} className="mb-0.5">
              <button
                onClick={() => toggleCat(name)}
                className={cn(
                  'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md',
                  'hover:bg-slate-800/50 transition-colors duration-150',
                )}
              >
                <span className="font-display uppercase tracking-wider text-[0.6875rem] text-amber-300/80 px-1.5 py-[2px] rounded-sm border border-amber-700/40 bg-slate-950/60 flex-1 truncate">
                  {name}
                </span>
                <span className="text-[0.5625rem] text-slate-600 tabular-nums mr-1">{count}</span>
                <svg
                  className={cn(
                    'w-2.5 h-2.5 text-slate-600 transition-transform duration-200',
                    !isExpanded && '-rotate-90',
                  )}
                  viewBox="0 0 10 10"
                  fill="currentColor"
                >
                  <path d="M2 3.5L5 7L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
              {isExpanded && visibleStats.length > 0 && (
                <div className="ml-3 mr-1 mb-1 space-y-px">
                  {visibleStats.map((s, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2 px-2 py-1 rounded',
                        'hover:bg-slate-800/30 transition-colors duration-100',
                      )}
                    >
                      <div className="text-[0.625rem] text-slate-400 leading-relaxed flex-1">
                        {highlightNumbers(s.stat)}
                      </div>
                      {(s.isNotable || s.isKeystone) && (
                        <span className={cn(
                          'shrink-0 w-1.5 h-1.5 rounded-full mt-1.5',
                          s.isKeystone ? 'bg-amber-400/60' : 'bg-sky-400/50',
                        )} title={s.source} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && search.trim() && (
          <div className="text-center text-slate-600 text-[0.6875rem] py-4">
            No matching stats
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AtlasTreeFullscreenModal({
  isOpen,
  onClose,
  allocatedNodes,
  categoryStats,
  contentCategories,
  diffNodes,
}: AtlasTreeFullscreenModalProps) {
  const { data: atlasTreeData, loading, error, retry } = useAtlasTreeData();
  const [showPanel, setShowPanel] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce search to avoid re-rendering the Pixi canvas on every keystroke
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(term), 300);
  }, []);

  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT : 1024,
  });

  const canvasWidth = showPanel && categoryStats ? dimensions.width - PANEL_WIDTH : dimensions.width;

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - HEADER_HEIGHT,
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = originalOverflow; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasStats = categoryStats && contentCategories && Object.keys(categoryStats).length > 0;

  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-[9999]',
        'bg-black/95',
        'flex flex-col',
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Atlas Passive Tree Fullscreen View"
    >
      {/* Header */}
      <header
        className={cn(
          'flex items-center justify-between px-4 sm:px-6',
          'h-14 bg-slate-900/95',
          'border-b border-slate-700/60'
        )}
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">
            Atlas Passive Tree
          </h2>
          <span
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium',
              'bg-sky-500/15 text-sky-400',
              'border border-sky-500/30'
            )}
          >
            {allocatedNodes.length} / 138 pts
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle stats panel */}
          {hasStats && (
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-md',
                'text-slate-400 hover:text-slate-100',
                'bg-slate-800/60 border border-slate-700/50',
                'hover:bg-slate-700/60 hover:border-slate-500',
                'transition-all duration-150',
              )}
              title={showPanel ? 'Hide stats panel' : 'Show stats panel'}
            >
              {showPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          )}
          {/* Close */}
          <button
            onClick={onClose}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-md',
              'text-slate-400 hover:text-slate-100',
              'bg-slate-800/60 border border-slate-700/50',
              'hover:bg-slate-700/60 hover:border-slate-500',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-sky-500/50'
            )}
            title="Close (ESC)"
            aria-label="Close atlas tree view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Canvas */}
        <main className="relative flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full text-slate-400">
              Loading atlas tree data...
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <span>Failed to load atlas tree: {error}</span>
              <button onClick={retry} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm">
                Retry
              </button>
            </div>
          )}
          {atlasTreeData && (
            <InteractiveTreeCanvas
              width={canvasWidth}
              height={dimensions.height}
              allocatedNodes={allocatedNodes}
              showControls={true}
              controlsPosition="bottom-right"
              treeDataOverride={atlasTreeData}
              searchHighlight={debouncedSearch}
              diffNodes={diffNodes ? { added: diffNodes, removed: [] } : null}
            />
          )}
        </main>

        {/* Stats panel */}
        {hasStats && showPanel && (
          <aside
            className={cn(
              'flex-shrink-0 border-l border-slate-700/60',
              'bg-[rgba(10,10,15,0.95)]',
            )}
            style={{ width: PANEL_WIDTH }}
          >
            <StatsPanel
              categoryStats={categoryStats!}
              contentCategories={contentCategories!}
              onSearchChange={handleSearchChange}
            />
          </aside>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
