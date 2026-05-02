/**
 * IntelCards — Dense newspaper-style sub-components for the Meta Intel drawer.
 *
 * Optimized for high information density with clickable headlines,
 * inline category labels, compact bylines, and column-rule separators.
 * Inspired by NYT broadsheet layout: serif headlines, tight leading,
 * minimal chrome, maximum content per viewport.
 */

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  Sword,
  Shield,
  Coins,
  Zap,
  Scroll,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { openExternal } from '../../utils/open-external';
import type { IntelItem } from '../../hooks/useMetaIntel';

// ============================================
// Category Configuration
// ============================================

export interface CategoryConfig {
  label: string;
  icon: typeof Sword;
  accentColor: string;
}

export const CATEGORY_MAP: Record<string, CategoryConfig> = {
  official: { label: 'Official', icon: Bell, accentColor: '#ef4444' },
  builds: { label: 'Builds', icon: Sword, accentColor: '#fbbf24' },
  strategies: { label: 'Strategies', icon: Shield, accentColor: '#34d399' },
  economy: { label: 'Economy', icon: Coins, accentColor: '#60a5fa' },
  mechanics: { label: 'Mechanics', icon: Zap, accentColor: '#a855f7' },
  meta: { label: 'Meta', icon: Scroll, accentColor: '#2dd4bf' },
};

export const CATEGORY_ORDER = ['official', 'builds', 'strategies', 'economy', 'mechanics', 'meta'];

// ============================================
// Source Labels
// ============================================

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  reddit: 'Reddit',
  forum: 'Forum',
  article: 'Article',
};

// ============================================
// Animation Variants
// ============================================

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

// ============================================
// Helpers
// ============================================

function formatBylineDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ============================================
// Article Top Bar (category label)
// ============================================

function ArticleTopBar({ category, showCategory = true }: { category: string; showCategory?: boolean }) {
  const catConfig = CATEGORY_MAP[category.toLowerCase()];
  if (!showCategory || !catConfig) return null;

  return (
    <span
      className="text-[0.5625rem] font-display font-bold uppercase tracking-[0.15em] leading-none block mb-0.5"
      style={{ color: catConfig.accentColor }}
    >
      {catConfig.label}
    </span>
  );
}

// ============================================
// Compact Byline (author · source · date)
// ============================================

function Byline({ item, className }: { item: IntelItem; className?: string }) {
  const sourceLabel = SOURCE_LABELS[item.source] ?? 'Web';
  return (
    <p className={cn('text-[0.625rem] text-slate-600', className)}>
      <span className="italic text-slate-500">{item.author}</span>
      {' \u00b7 '}{sourceLabel}{' \u00b7 '}{formatBylineDate(item.publishedDate)}
    </p>
  );
}

// ============================================
// Compact Build Info (single line)
// ============================================

function BuildInfo({ item }: { item: IntelItem }) {
  if (!item.buildInfo) return null;
  const { skill, ascendancy, budget, keyUniques } = item.buildInfo;
  return (
    <p className="text-[0.5625rem] text-slate-500 mt-1 leading-relaxed truncate">
      <span className="text-amber-300/70 font-semibold">{skill}</span>
      {' \u00b7 '}<span className="text-slate-400">{ascendancy}</span>
      {' \u00b7 '}<span className="text-emerald-400/60">{budget}</span>
      {keyUniques.length > 0 && (
        <>
          {' \u00b7 '}
          <span className="text-[#af6025]">{keyUniques.slice(0, 2).join(', ')}</span>
        </>
      )}
    </p>
  );
}

// ============================================
// Masthead Double Gold Line
// ============================================

export function MastheadDivider() {
  return (
    <div className="space-y-[2px]">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
    </div>
  );
}

// ============================================
// Lead Article (full-width, top story)
// ============================================

export function LeadArticle({ item }: { item: IntelItem }) {
  const handleClick = useCallback(() => openExternal(item.url), [item.url]);

  return (
    <motion.article variants={itemVariants}>
      <ArticleTopBar category={item.category} />

      <button onClick={handleClick} className="text-left group block mt-0.5 w-full">
        <h2 className="text-lg font-display font-bold text-amber-100 leading-tight group-hover:text-amber-50 transition-colors">
          {item.title}
          <ExternalLink className="inline w-3 h-3 ml-1.5 opacity-0 group-hover:opacity-40 transition-opacity -translate-y-px" />
        </h2>
      </button>

      <Byline item={item} className="mt-1" />

      <div className="mt-2 flex gap-6">
        {/* Summary column */}
        <p className="text-[0.8125rem] text-slate-400 leading-relaxed flex-1 max-w-2xl">
          {item.summary}
        </p>

        {/* Takeaways column (if available) */}
        {item.keyTakeaways.length > 0 && (
          <div className="border-l border-amber-500/15 pl-4 flex-1 max-w-sm hidden xl:block">
            {item.keyTakeaways.slice(0, 3).map((t, i) => (
              <p key={i} className="text-[0.6875rem] text-slate-500 leading-snug italic mb-1 last:mb-0">
                {t}
              </p>
            ))}
          </div>
        )}
      </div>

      <BuildInfo item={item} />
    </motion.article>
  );
}

// ============================================
// Secondary Lead (for the top row, beside lead)
// ============================================

export function SecondaryLead({ item, showCategory = true }: { item: IntelItem; showCategory?: boolean }) {
  const handleClick = useCallback(() => openExternal(item.url), [item.url]);

  return (
    <motion.article variants={itemVariants}>
      <ArticleTopBar category={item.category} showCategory={showCategory} />

      <button onClick={handleClick} className="text-left group block mt-0.5 w-full">
        <h3 className="text-[0.9375rem] font-display font-semibold text-amber-200/90 leading-snug group-hover:text-amber-100 transition-colors">
          {item.title}
        </h3>
      </button>

      <Byline item={item} className="mt-0.5" />

      <p className="text-[0.75rem] text-slate-400 leading-relaxed mt-1.5 line-clamp-3">
        {item.summary}
      </p>

      {item.keyTakeaways.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {item.keyTakeaways.slice(0, 2).map((t, i) => (
            <p key={i} className="text-[0.625rem] text-slate-500 leading-snug italic pl-2 border-l border-amber-500/15">
              {t}
            </p>
          ))}
        </div>
      )}

      <BuildInfo item={item} />
    </motion.article>
  );
}

// ============================================
// Column Article (compact, for 3-col grid)
// ============================================

export function ColumnArticle({ item, showCategory = true }: { item: IntelItem; showCategory?: boolean }) {
  const handleClick = useCallback(() => openExternal(item.url), [item.url]);

  return (
    <motion.article variants={itemVariants} className="py-2 first:pt-0">
      <ArticleTopBar category={item.category} showCategory={showCategory} />

      <button onClick={handleClick} className="text-left group block mt-0.5 w-full">
        <h3 className="text-[0.8125rem] font-display font-semibold text-amber-200/85 leading-snug group-hover:text-amber-100 transition-colors">
          {item.title}
        </h3>
      </button>

      <Byline item={item} className="mt-0.5" />

      <p className="text-[0.6875rem] text-slate-500 leading-relaxed mt-1 line-clamp-2">
        {item.summary}
      </p>

      <BuildInfo item={item} />

      {/* Thin separator */}
      <div className="h-px bg-amber-900/15 mt-2.5" />
    </motion.article>
  );
}
