/**
 * StashOverviewModal — Full-screen modal showing stash wealth analysis.
 *
 * "The Exile's Vault" — Dark fantasy forge aesthetic with amber/gold accents.
 * Follows the same structural pattern as LadderBenchmarksModal.
 *
 * Features:
 * - SSE-streamed stash scanning with live progress bar
 * - Five tabs: Overview, Currency, Maps, Crafting, Valuables
 * - GGG item icons, chaos-equivalent pricing, rarity-colored borders
 * - Cached results for instant re-opens with manual refresh
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  PackageOpen,
  Layers,
  Coins,
  Map,
  Sparkles,
  Crown,
  Loader2,
  AlertCircle,
  RefreshCw,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDesktopStore } from '../../store';
import { useStashOverview } from './hooks/useStashOverview';
import { WealthSummarySection } from './sections/WealthSummarySection';
import { CurrencySection } from './sections/CurrencySection';
import { MapPoolSection } from './sections/MapPoolSection';
import { CraftingSection } from './sections/CraftingSection';
import { ValuablesSection } from './sections/ValuablesSection';

// =============================================================================
// Types
// =============================================================================

interface StashOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StashTab = 'overview' | 'currency' | 'maps' | 'crafting' | 'valuables';

interface TabConfig {
  id: StashTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
  { id: 'currency', label: 'Currency', icon: <Coins className="w-4 h-4" /> },
  { id: 'maps', label: 'Maps', icon: <Map className="w-4 h-4" /> },
  { id: 'crafting', label: 'Crafting', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'valuables', label: 'Valuables', icon: <Crown className="w-4 h-4" /> },
];

// =============================================================================
// Component
// =============================================================================

export function StashOverviewModal({ isOpen, onClose }: StashOverviewModalProps) {
  const [activeTab, setActiveTab] = useState<StashTab>('overview');
  const hasToken = !!useDesktopStore((s) => s.gggAccessToken);
  const { data, isLoading, progress, error, refetch } = useStashOverview(isOpen && hasToken);

  // Tab content renderer
  const tabContent = useMemo(() => {
    if (!hasToken) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(251,191,36,0.15) 0%, rgba(180,83,9,0.08) 50%, transparent 70%)',
              border: '1px solid rgba(251,191,36,0.2)',
            }}
          >
            <LogIn className="w-6 h-6 text-amber-400/60" />
          </div>
          <h3 className="text-lg font-display font-semibold text-amber-200/80 mb-2">Login Required</h3>
          <p className="text-sm text-slate-400 max-w-md">
            Log in with your Path of Exile account via OAuth to view your stash contents and wealth analysis.
          </p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative mb-6">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            <div className="absolute inset-0 blur-md bg-amber-500/20 rounded-full" />
          </div>
          <h3 className="text-base font-display font-semibold text-amber-200/90 mb-2">Scanning Stash Tabs</h3>
          {progress && (
            <>
              <p className="text-sm text-slate-400 mb-4">
                Tab {progress.tabsScanned} of {progress.totalTabs}: <span className="text-slate-300">{progress.currentTab}</span>
              </p>
              <div className="w-64 h-2 rounded-full bg-slate-800/60 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #fbbf24 0%, rgba(251,191,36,0.6) 100%)',
                    boxShadow: '0 0 8px rgba(251,191,36,0.3)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.tabsScanned / progress.totalTabs) * 100}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-red-400/60 mb-4" />
          <h3 className="text-base font-display font-semibold text-red-300/80 mb-2">Scan Failed</h3>
          <p className="text-sm text-slate-400 max-w-md mb-4">{error}</p>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm hover:bg-amber-500/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <PackageOpen className="w-10 h-10 mb-3 text-slate-600" />
          <span className="text-sm">No stash data available</span>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <WealthSummarySection data={data} />;
      case 'currency':
        return <CurrencySection liquidCurrency={data.liquidCurrency} craftingMaterials={data.craftingMaterials} />;
      case 'maps':
        return <MapPoolSection mapPool={data.mapPool} />;
      case 'crafting':
        return <CraftingSection essences={data.essences} fragments={data.fragments} />;
      case 'valuables':
        return <ValuablesSection valuableItems={data.valuableItems} divinationCards={data.divinationCards} />;
    }
  }, [activeTab, data, isLoading, progress, error, hasToken, refetch]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        className="fixed inset-0 z-[60]"
        style={{
          background: `
            radial-gradient(ellipse at 50% 30%, rgba(251, 191, 36, 0.04) 0%, transparent 60%),
            rgba(0, 0, 0, 0.85)
          `,
          backdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'fixed inset-4 md:inset-8 lg:inset-12 z-[61]',
          'flex flex-col overflow-hidden rounded-xl'
        )}
        style={{
          background: `
            linear-gradient(180deg,
              rgba(18, 14, 10, 0.98) 0%,
              rgba(12, 9, 6, 0.99) 100%
            )
          `,
          border: '1px solid rgba(251, 191, 36, 0.12)',
          boxShadow: `
            0 0 80px rgba(0, 0, 0, 0.8),
            0 0 40px rgba(251, 191, 36, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.03)
          `,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Stash Overview"
      >
        {/* ===== Header ===== */}
        <div className="flex-shrink-0 border-b border-amber-900/25 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: title + metadata */}
            <div className="flex items-center gap-4">
              {/* Vault orb */}
              <div className="relative">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.25) 0%, rgba(180, 83, 9, 0.12) 50%, transparent 70%)',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    boxShadow: '0 0 24px rgba(180, 83, 9, 0.2), inset 0 0 15px rgba(251, 191, 36, 0.08)',
                  }}
                >
                  <PackageOpen className="w-5 h-5 text-amber-300" />
                </div>
                <div
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400/50 animate-pulse"
                  style={{ boxShadow: '0 0 6px rgba(251, 191, 36, 0.5)' }}
                />
              </div>

              <div>
                <h2 className="font-display text-lg font-semibold text-amber-100 tracking-wider uppercase">
                  Stash Overview
                </h2>
                {data && (
                  <p className="text-[0.6875rem] text-amber-400/60 mt-0.5">
                    {data.league} • {data.tabsScanned} tabs • {new Date(data.fetchedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {/* Right: refresh + close */}
            <div className="flex items-center gap-2">
              {data && !isLoading && (
                <button
                  onClick={refetch}
                  className="p-2 rounded-lg hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-colors"
                  title="Refresh stash data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          {hasToken && data && (
            <div className="flex gap-1 mt-4 -mb-4 px-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-[0.75rem] font-medium',
                    'transition-all duration-200',
                    activeTab === tab.id
                      ? 'text-amber-200 bg-amber-500/8 border-b-2 border-amber-400'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                  )}
                >
                  <span className={activeTab === tab.id ? 'text-amber-400' : ''}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===== Scrollable Content ===== */}
        <div className="flex-1 overflow-y-auto scrollbar-fantasy px-6 py-6">
          {tabContent}
        </div>

        {/* Bottom edge glow */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{
          background: 'linear-gradient(90deg, transparent 10%, rgba(251,191,36,0.08) 50%, transparent 90%)',
        }} />
      </motion.div>
    </>
  );
}
