/**
 * TradeConfigCard Component
 *
 * Inline expandable card for configuring and executing trade searches.
 * Appears below LLM messages when trade search is suggested.
 *
 * Two modes:
 * - Weighted slots (ring, amulet, weapon, jewel): Budget only
 * - Affix slots (helmet, body, gloves, boots, belt, shield): Budget + mod selection
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Check,
  X,
  Star,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { openExternal } from '../../utils/open-external';
import type {
  TradeSearchAction,
  RecommendedMod,
  TradeConfigState,
  TradeSearchResults,
} from '../../../../shared/types/SuggestedAction';
import { isWeightedSlot, formatSlotName } from '../../../../shared/types/SuggestedAction';

export interface TradeConfigCardProps {
  action: TradeSearchAction;
  onSearch: (config: TradeSearchConfig) => Promise<void>;
  className?: string;
}

export interface TradeSearchConfig {
  slot: string;
  searchMode: 'weighted' | 'affix';
  budget: { amount: number; currency: 'chaos' | 'divine' };
  enabledMods?: string[];
  modMinValues?: Record<string, number>;
}

/**
 * Trade configuration and execution card.
 */
export function TradeConfigCard({ action, onSearch, className }: TradeConfigCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [budget, setBudget] = useState(action.suggestedBudget || { amount: 50, currency: 'chaos' as const });
  const [enabledMods, setEnabledMods] = useState<Set<string>>(() => {
    // Initialize with recommended mods enabled
    const recommended = (action.recommendedMods || [])
      .filter(m => m.recommended)
      .map(m => m.id);
    return new Set(recommended);
  });
  const [modMinValues, setModMinValues] = useState<Record<string, number>>(() => {
    // Initialize with recommended min values
    const values: Record<string, number> = {};
    (action.recommendedMods || []).forEach(m => {
      values[m.id] = m.recommendedMin;
    });
    return values;
  });
  const [executionState, setExecutionState] = useState<'idle' | 'searching' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState<TradeConfigState['progress']>();
  const [results, setResults] = useState<TradeSearchResults>();
  const [error, setError] = useState<string>();

  const isWeighted = isWeightedSlot(action.slot);
  const slotName = formatSlotName(action.slot);

  // Group mods by affix type
  const prefixes = (action.recommendedMods || []).filter(m => m.affixType === 'prefix');
  const suffixes = (action.recommendedMods || []).filter(m => m.affixType === 'suffix');

  const handleToggleMod = useCallback((modId: string) => {
    setEnabledMods(prev => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
      } else {
        next.add(modId);
      }
      return next;
    });
  }, []);

  const handleMinValueChange = useCallback((modId: string, value: number) => {
    setModMinValues(prev => ({ ...prev, [modId]: value }));
  }, []);

  const handleSearch = useCallback(async () => {
    setExecutionState('searching');
    setError(undefined);
    setProgress(undefined);
    setResults(undefined);

    try {
      const config: TradeSearchConfig = {
        slot: action.slot,
        searchMode: action.searchMode,
        budget,
        enabledMods: Array.from(enabledMods),
        modMinValues,
      };

      await onSearch(config);
      setExecutionState('complete');
    } catch (err) {
      setExecutionState('error');
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }, [action, budget, enabledMods, modMinValues, onSearch]);

  const isSearching = executionState === 'searching';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border overflow-hidden',
        'border-slate-700/50 bg-slate-800/50',
        className
      )}
    >
      {/* Collapsed Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'hover:bg-slate-700/30 transition-colors',
          'text-left'
        )}
      >
        <div className="flex items-center gap-3">
          <Search className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-100">
            Search Trade for {slotName}
          </span>
          {action.context && !isExpanded && (
            <span className="text-xs text-slate-400 truncate max-w-[200px]">
              {action.context}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {executionState === 'complete' && (
            <Check className="w-4 h-4 text-green-400" />
          )}
          {executionState === 'error' && (
            <X className="w-4 h-4 text-red-400" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50">
              {/* Context */}
              {action.context && (
                <p className="text-xs text-slate-400 pt-3">{action.context}</p>
              )}

              {/* Budget Section */}
              <div className="pt-2">
                <label className="block text-xs text-slate-400 mb-2">Budget</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={budget.amount}
                    onChange={(e) => setBudget(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                    min={1}
                    className={cn(
                      'w-24 px-3 py-1.5 rounded-md text-sm',
                      'bg-slate-900/50 border border-slate-600/50',
                      'text-slate-100 placeholder-slate-500',
                      'focus:outline-none focus:ring-1 focus:ring-amber-500/50'
                    )}
                    disabled={isSearching}
                  />
                  <div className="flex items-center gap-1 bg-slate-900/50 rounded-md p-0.5">
                    <button
                      onClick={() => setBudget(prev => ({ ...prev, currency: 'chaos' }))}
                      className={cn(
                        'px-2 py-1 rounded text-xs transition-colors',
                        budget.currency === 'chaos'
                          ? 'bg-amber-600/80 text-white'
                          : 'text-slate-400 hover:text-slate-300'
                      )}
                      disabled={isSearching}
                    >
                      Chaos
                    </button>
                    <button
                      onClick={() => setBudget(prev => ({ ...prev, currency: 'divine' }))}
                      className={cn(
                        'px-2 py-1 rounded text-xs transition-colors',
                        budget.currency === 'divine'
                          ? 'bg-amber-600/80 text-white'
                          : 'text-slate-400 hover:text-slate-300'
                      )}
                      disabled={isSearching}
                    >
                      Divine
                    </button>
                  </div>
                </div>
              </div>

              {/* Mod Selection (Affix slots only) */}
              {!isWeighted && (action.recommendedMods?.length ?? 0) > 0 && (
                <div className="space-y-3">
                  {/* Prefixes */}
                  {prefixes.length > 0 && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Prefixes (pick 1-3)
                      </label>
                      <div className="space-y-2">
                        {prefixes.map(mod => (
                          <ModRow
                            key={mod.id}
                            mod={mod}
                            enabled={enabledMods.has(mod.id)}
                            minValue={modMinValues[mod.id] || mod.recommendedMin}
                            onToggle={() => handleToggleMod(mod.id)}
                            onMinChange={(v) => handleMinValueChange(mod.id, v)}
                            disabled={isSearching}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suffixes */}
                  {suffixes.length > 0 && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Suffixes (pick 1-3)
                      </label>
                      <div className="space-y-2">
                        {suffixes.map(mod => (
                          <ModRow
                            key={mod.id}
                            mod={mod}
                            enabled={enabledMods.has(mod.id)}
                            minValue={modMinValues[mod.id] || mod.recommendedMin}
                            onToggle={() => handleToggleMod(mod.id)}
                            onMinChange={(v) => handleMinValueChange(mod.id, v)}
                            disabled={isSearching}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Weighted slot explanation */}
              {isWeighted && (
                <p className="text-xs text-slate-400 pt-2">
                  PoB will optimize for your build's DPS and survivability.
                </p>
              )}

              {/* Progress (when searching) */}
              {isSearching && progress && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>
                      Iteration {progress.iteration}
                      {progress.maxIterations ? ` / ${progress.maxIterations}` : ''}
                    </span>
                    <span>
                      {progress.resultCount !== undefined
                        ? `${progress.resultCount} results`
                        : 'Searching...'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-amber-500"
                      initial={{ width: '0%' }}
                      animate={{
                        width: `${Math.min((progress.iteration / (progress.maxIterations || 5)) * 100, 100)}%`
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  {progress.minPrice !== undefined && (
                    <div className="text-xs text-slate-400">
                      Min price: {progress.minPrice}c
                      {progress.budgetUtilization !== undefined && (
                        <span className="ml-2">
                          ({progress.budgetUtilization}% of budget)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {executionState === 'complete' && results && (
                <TradeResultsSection results={results} />
              )}

              {/* Error */}
              {executionState === 'error' && error && (
                <p className="text-xs text-red-400 pt-2">{error}</p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsExpanded(false)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm',
                    'text-slate-400 hover:text-slate-300',
                    'transition-colors'
                  )}
                  disabled={isSearching}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || (!isWeighted && enabledMods.size === 0)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm',
                    'bg-amber-600 hover:bg-amber-500 text-white',
                    'transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Single mod row with toggle and min value input.
 */
interface ModRowProps {
  mod: RecommendedMod;
  enabled: boolean;
  minValue: number;
  onToggle: () => void;
  onMinChange: (value: number) => void;
  disabled?: boolean;
}

function ModRow({ mod, enabled, minValue, onToggle, onMinChange, disabled }: ModRowProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          'w-5 h-5 rounded border flex items-center justify-center',
          'transition-colors',
          enabled
            ? 'bg-amber-600/80 border-amber-500'
            : 'bg-slate-800 border-slate-600 hover:border-slate-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {enabled && <Check className="w-3 h-3 text-white" />}
      </button>
      <span className={cn(
        'flex-1 text-sm',
        enabled ? 'text-slate-200' : 'text-slate-400'
      )}>
        {mod.name}
      </span>
      {mod.recommended && (
        <Star className="w-3 h-3 text-amber-400" />
      )}
      {enabled && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">min:</span>
          <input
            type="number"
            value={minValue}
            onChange={(e) => onMinChange(parseInt(e.target.value) || 0)}
            disabled={disabled}
            className={cn(
              'w-16 px-2 py-1 rounded text-xs',
              'bg-slate-900/50 border border-slate-600/50',
              'text-slate-100',
              'focus:outline-none focus:ring-1 focus:ring-amber-500/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Trade results display section.
 */
interface TradeResultsSectionProps {
  results: TradeSearchResults;
}

function TradeResultsSection({ results }: TradeResultsSectionProps) {
  return (
    <div className="space-y-3 pt-2">
      {/* Summary */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-green-400">
          {results.totalResults} {results.totalResults === 1 ? 'item' : 'items'} found
        </span>
        {results.budgetUtilization !== undefined && (
          <span className={cn(
            results.budgetUtilization >= 80 ? 'text-green-400' : 'text-slate-400'
          )}>
            {results.budgetUtilization}% budget used
          </span>
        )}
      </div>

      {/* Top items */}
      {results.items.length > 0 && (
        <div className="space-y-2">
          {results.items.slice(0, 3).map((item, idx) => (
            <div
              key={idx}
              className={cn(
                'p-2 rounded-md border',
                item.isBestValue
                  ? 'border-green-600/50 bg-green-950/20'
                  : 'border-slate-700/50 bg-slate-900/30'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.isBestValue && (
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-green-600/80 text-white">
                      Best Value
                    </span>
                  )}
                  <span className="text-sm text-slate-100">{item.name}</span>
                </div>
                <span className="text-sm text-amber-400">
                  {item.price.amount}{item.price.currency === 'chaos' ? 'c' : 'd'}
                </span>
              </div>
              {item.statChanges && (
                <div className="flex gap-3 mt-1 text-xs">
                  {item.statChanges.dps && (
                    <span className={cn(
                      item.statChanges.dps.percent > 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {item.statChanges.dps.percent > 0 ? '+' : ''}
                      {item.statChanges.dps.percent.toFixed(1)}% DPS
                    </span>
                  )}
                  {item.statChanges.ehp && (
                    <span className={cn(
                      item.statChanges.ehp.percent > 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {item.statChanges.ehp.percent > 0 ? '+' : ''}
                      {item.statChanges.ehp.percent.toFixed(1)}% EHP
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {results.items.length > 3 && (
            <p className="text-xs text-slate-500">
              + {results.items.length - 3} more results
            </p>
          )}
        </div>
      )}

      {/* Trade link */}
      {results.tradeUrl && (
        <button
          onClick={() => { openExternal(results.tradeUrl!); }}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-2 rounded-md',
            'bg-slate-700/50 hover:bg-slate-700 text-slate-200',
            'transition-colors text-sm w-full'
          )}
        >
          <ExternalLink className="w-4 h-4" />
          Open on Trade Site
        </button>
      )}
    </div>
  );
}

export default TradeConfigCard;
