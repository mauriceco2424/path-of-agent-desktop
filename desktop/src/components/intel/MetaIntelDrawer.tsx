/**
 * MetaIntelDrawer — NYT Editorial-style full-screen "Meta Intel" modal.
 *
 * Layout:
 *   Masthead: "META INTEL" newspaper header with dateline + day selector
 *   Left sidebar: Subtle text-based section index (newspaper TOC)
 *   Main content: Hero article (top item) + two-column article grid
 *
 * Design: NYT editorial typography (Cinzel serif) merged with
 * Onyx Gold dark fantasy palette (amber/gold accents, deep backgrounds).
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RefreshCw,
  AlertCircle,
  Newspaper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaIntel } from '../../hooks/useMetaIntel';
import {
  CATEGORY_MAP,
  CATEGORY_ORDER,
  containerVariants,
  LeadArticle,
  SecondaryLead,
  ColumnArticle,
  MastheadDivider,
} from './IntelCards';

// ============================================
// Types
// ============================================

interface MetaIntelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================
// Helpers
// ============================================

function formatMastheadDate(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const month = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const day = now.getDate();
  const year = now.getFullYear();

  // Calculate league week (Mirage started March 5, 2026)
  const leagueStart = new Date(2026, 2, 5); // March 5, 2026
  const diffMs = now.getTime() - leagueStart.getTime();
  const leagueWeek = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));

  return `${weekday}, ${month} ${day}, ${year}  \u2022  MIRAGE LEAGUE  \u2022  WEEK ${leagueWeek}`;
}

// ============================================
// Main Modal Component
// ============================================

export function MetaIntelDrawer({ isOpen, onClose }: MetaIntelDrawerProps) {
  const {
    allItems,
    totalCount,
    loading,
    error,
    refetch,
    selectedDay,
    setSelectedDay,
    availableDays,
  } = useMetaIntel();

  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      const cat = item.category.toLowerCase();
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  // Filter items by active category
  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return allItems;
    return allItems.filter((item) => item.category.toLowerCase() === activeCategory);
  }, [allItems, activeCategory]);

  // Split: lead (top story) + secondary (sidebar) + grid (3-col)
  const { leadItem, secondaryItem, gridItems } = useMemo(() => {
    if (filteredItems.length === 0) return { leadItem: null, secondaryItem: null, gridItems: [] };
    const sorted = [...filteredItems].sort((a, b) => b.relevance - a.relevance);
    return {
      leadItem: sorted[0],
      secondaryItem: sorted.length > 2 ? sorted[1] : null,
      gridItems: sorted.slice(sorted.length > 2 ? 2 : 1),
    };
  }, [filteredItems]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[60]"
            style={{
              background: `
                radial-gradient(ellipse at 50% 30%, rgba(251, 191, 36, 0.03) 0%, transparent 60%),
                rgba(0, 0, 0, 0.88)
              `,
              backdropFilter: 'blur(4px)',
            }}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed inset-4 md:inset-8 lg:inset-12 z-[61]',
              'flex flex-col overflow-hidden rounded-xl'
            )}
            style={{
              background: 'linear-gradient(180deg, rgba(16, 13, 10, 0.99) 0%, rgba(10, 8, 6, 0.99) 100%)',
              border: '1px solid rgba(251, 191, 36, 0.10)',
              boxShadow: `
                0 0 80px rgba(0, 0, 0, 0.8),
                0 0 40px rgba(251, 191, 36, 0.04),
                inset 0 1px 0 rgba(255, 255, 255, 0.02)
              `,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Meta Intel"
          >
            {/* ===== Masthead (compressed) ===== */}
            <div className="flex-shrink-0 px-5 pt-2.5 pb-1.5 relative">
              {/* Refresh + close — absolutely positioned top-right */}
              <div className="absolute top-2 right-4 flex items-center gap-1">
                <button
                  onClick={refetch}
                  disabled={loading}
                  className={cn(
                    'rounded-lg p-1.5 transition-all duration-200',
                    'text-slate-600 hover:text-amber-400/60',
                    loading && 'animate-spin',
                  )}
                  aria-label="Refresh intel"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 transition-all duration-200 text-slate-600 hover:text-amber-400/60"
                  aria-label="Close meta intel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Newspaper name */}
              <div className="text-center mb-1">
                <h1
                  className="font-display text-xl font-bold tracking-[0.3em] uppercase text-amber-100"
                  style={{ textShadow: '0 0 20px rgba(251, 191, 36, 0.12)' }}
                >
                  Meta Intel
                </h1>
              </div>

              {/* Double gold line */}
              <MastheadDivider />

              {/* Dateline */}
              <p className="text-center text-[0.625rem] font-display uppercase tracking-[0.2em] text-amber-500/50 mt-1.5 mb-1.5">
                {formatMastheadDate()}
              </p>

              {/* Day selector tabs */}
              <div className="flex justify-center gap-0.5">
                {availableDays.length > 0 ? (
                  availableDays.map((day, i) => {
                    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday'
                      : new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(i)}
                        className={cn(
                          'relative px-2.5 py-1 text-[0.625rem] font-display tracking-wider uppercase',
                          'transition-all duration-200',
                          selectedDay === i
                            ? 'text-amber-200/90'
                            : 'text-slate-600 hover:text-slate-400',
                        )}
                      >
                        {label}
                        {selectedDay === i && (
                          <motion.div
                            layoutId="intel-day-indicator"
                            className="absolute bottom-0 left-2.5 right-2.5 h-px"
                            style={{
                              background: 'linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.4) 50%, transparent 100%)',
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-[0.625rem] text-slate-600 font-display tracking-wider uppercase py-1">
                    Loading editions...
                  </span>
                )}
              </div>

              {/* Bottom rule */}
              <div className="h-px bg-amber-500/10 mt-1.5" />
            </div>

            {/* ===== Body: Sidebar + Content ===== */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left sidebar -- newspaper section index */}
              <div className="w-36 flex-shrink-0 border-r border-amber-900/15 py-3 overflow-y-auto scrollbar-fantasy">
                {/* All */}
                <button
                  onClick={() => setActiveCategory('all')}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-1.5 text-left transition-all duration-200',
                    activeCategory === 'all'
                      ? 'border-l-2 border-amber-400'
                      : 'border-l-2 border-transparent hover:border-amber-900/30',
                  )}
                >
                  <span className={cn(
                    'text-[0.6875rem] font-display uppercase tracking-[0.15em]',
                    activeCategory === 'all' ? 'text-amber-200 font-bold' : 'text-slate-500 font-medium',
                  )}>
                    All
                  </span>
                  <span className={cn(
                    'text-[0.5625rem] font-mono',
                    activeCategory === 'all' ? 'text-amber-400/70' : 'text-slate-700',
                  )}>
                    {allItems.length}
                  </span>
                </button>

                {/* Thin divider */}
                <div className="h-px mx-4 my-1.5 bg-amber-500/10" />

                {/* Category links */}
                {CATEGORY_ORDER.map((cat) => {
                  const config = CATEGORY_MAP[cat];
                  if (!config) return null;
                  const count = categoryCounts[cat] ?? 0;
                  const isActive = activeCategory === cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-1.5 text-left transition-all duration-200',
                        isActive
                          ? 'border-l-2 border-amber-400'
                          : 'border-l-2 border-transparent hover:border-amber-900/30',
                        count === 0 && 'opacity-30',
                      )}
                      disabled={count === 0}
                    >
                      <span className={cn(
                        'text-[0.6875rem] font-display uppercase tracking-[0.15em]',
                        isActive ? 'text-amber-200 font-bold' : 'text-slate-500 font-medium',
                      )}>
                        {config.label}
                      </span>
                      <span className={cn(
                        'text-[0.5625rem] font-mono',
                        isActive ? 'text-amber-400/70' : 'text-slate-700',
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}

                {/* Bottom meta */}
                {totalCount > 0 && (
                  <div className="mt-4 px-4">
                    <div className="h-px bg-amber-500/10 mb-2" />
                    <p className="text-[0.5625rem] text-slate-700 leading-relaxed">
                      {totalCount} items this week
                    </p>
                    <p className="text-[0.5625rem] text-slate-700">
                      3.28 Mirage League
                    </p>
                  </div>
                )}
              </div>

              {/* Main content area */}
              <div className="flex-1 overflow-y-auto scrollbar-fantasy px-5 py-4">
                {/* Loading state */}
                {loading && allItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCw className="w-4 h-4 text-amber-500/40 animate-spin" />
                    <span className="text-[0.625rem] font-display tracking-[0.2em] uppercase text-slate-600">
                      Gathering intelligence...
                    </span>
                  </div>
                )}

                {/* Error state */}
                {error && allItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400/60" />
                    <span className="text-sm text-slate-400 text-center max-w-sm">{error}</span>
                    <button
                      onClick={refetch}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[0.625rem] font-display tracking-wider uppercase',
                        'border border-amber-500/20 text-amber-300/80',
                        'hover:border-amber-500/30 hover:text-amber-200 transition-all duration-200',
                      )}
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Empty state */}
                {!loading && !error && allItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Newspaper className="w-6 h-6 text-slate-700" />
                    <span className="text-[0.625rem] font-display tracking-[0.2em] uppercase text-slate-600">
                      No intel available
                    </span>
                    <span className="text-[0.625rem] text-slate-700 text-center max-w-sm">
                      The scanner has not found new content yet. Check back soon.
                    </span>
                  </div>
                )}

                {/* ===== Newspaper Content Layout ===== */}
                {filteredItems.length > 0 && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeCategory}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {/* Top row: Lead (cols 1-2) + Secondary (col 3) — same grid as below */}
                        {leadItem && (
                          <>
                            <div className={cn(
                              'grid items-start xl:grid-cols-3',
                            )}>
                              <div className={cn(
                                secondaryItem
                                  ? 'xl:col-span-2 xl:pr-4 xl:border-r xl:border-amber-900/12'
                                  : 'xl:col-span-3',
                              )}>
                                <LeadArticle item={leadItem} />
                              </div>
                              {secondaryItem && (
                                <div className="xl:pl-4">
                                  <SecondaryLead
                                    item={secondaryItem}
                                    showCategory={activeCategory === 'all'}
                                  />
                                </div>
                              )}
                            </div>
                            {/* Full-width rule below lead row */}
                            <div
                              className="h-px mt-4 mb-1"
                              style={{
                                background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.25) 0%, rgba(251, 191, 36, 0.12) 40%, transparent 100%)',
                              }}
                            />
                          </>
                        )}

                        {/* 3-column newspaper grid */}
                        {gridItems.length > 0 && (
                          <div className="grid xl:grid-cols-3 mt-1">
                            {gridItems.map((item, idx) => {
                              const col = idx % 3;
                              return (
                                <div
                                  key={`grid-${idx}`}
                                  className={cn(
                                    // Per-column padding + column rules
                                    col === 0 && 'xl:pr-4 xl:border-r xl:border-amber-900/12',
                                    col === 1 && 'xl:px-4 xl:border-r xl:border-amber-900/12',
                                    col === 2 && 'xl:pl-4',
                                  )}
                                >
                                  <ColumnArticle
                                    item={item}
                                    showCategory={activeCategory === 'all'}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* ===== Footer ===== */}
            {allItems.length > 0 && (
              <div className="flex-shrink-0 px-5 py-2">
                <div className="h-px bg-amber-500/10 mb-2" />
                <div className="flex items-center justify-between">
                  <span className="text-[0.5625rem] text-slate-700 font-display tracking-wider uppercase">
                    Sources: YouTube &bull; Reddit &bull; GGG Forums &bull; Community
                  </span>
                  <span className="text-[0.5625rem] text-slate-700 font-mono">
                    {allItems.length} articles &bull; {availableDays[selectedDay] ?? ''}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
