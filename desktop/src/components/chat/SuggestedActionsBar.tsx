/**
 * SuggestedActionsBar Component
 *
 * Displays action buttons below LLM messages.
 * Users can click buttons to expand configuration panels for actions.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Hammer, Compass, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SuggestedAction, TradeSearchAction } from '../../../../shared/types/SuggestedAction';
import { getActionLabel } from '../../../../shared/types/SuggestedAction';
import { TradeConfigCard, type TradeSearchConfig } from './TradeConfigCard';
import { FEATURE_FLAGS } from '../../feature-flags';

export interface SuggestedActionsBarProps {
  actions: SuggestedAction[];
  header?: string;
  onTradeSearch: (config: TradeSearchConfig) => Promise<void>;
  className?: string;
}

/**
 * Get icon for action type.
 */
function getActionIcon(type: SuggestedAction['type']) {
  switch (type) {
    case 'trade_search':
      return Search;
    case 'crafting':
      return Hammer;
    case 'explore':
      return Compass;
    default:
      return ChevronRight;
  }
}

/**
 * Bar displaying suggested action buttons.
 */
export function SuggestedActionsBar({
  actions,
  header,
  onTradeSearch,
  className,
}: SuggestedActionsBarProps) {
  const [expandedActionIndex, setExpandedActionIndex] = useState<number | null>(null);

  const handleActionClick = useCallback((index: number) => {
    setExpandedActionIndex(prev => (prev === index ? null : index));
  }, []);

  // Filter out trade_search actions when feature is disabled
  const visibleActions = FEATURE_FLAGS.TRADE_SEARCH
    ? actions
    : actions.filter(a => a.type !== 'trade_search');

  if (visibleActions.length === 0) {
    return null;
  }

  const expandedAction = expandedActionIndex !== null ? visibleActions[expandedActionIndex] : null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      {header && (
        <p className="text-xs text-slate-400">{header}</p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action, index) => {
          const Icon = getActionIcon(action.type);
          const isExpanded = expandedActionIndex === index;

          return (
            <motion.button
              key={index}
              onClick={() => handleActionClick(index)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg',
                'text-sm font-medium transition-colors',
                'border',
                isExpanded
                  ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:text-slate-200'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{getActionLabel(action)}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Expanded Action Panel */}
      <AnimatePresence>
        {expandedAction && expandedAction.type === 'trade_search' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TradeConfigCard
              action={expandedAction as TradeSearchAction}
              onSearch={onTradeSearch}
              className="mt-2"
            />
          </motion.div>
        )}

        {expandedAction && expandedAction.type === 'crafting' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 p-4 rounded-lg border border-slate-700/50 bg-slate-800/50"
          >
            <p className="text-sm text-slate-300">
              Crafting configuration coming soon.
            </p>
          </motion.div>
        )}

        {expandedAction && expandedAction.type === 'explore' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 p-4 rounded-lg border border-slate-700/50 bg-slate-800/50"
          >
            <p className="text-sm text-slate-300 mb-3">
              Explore: {expandedAction.topic}
            </p>
            {expandedAction.options && expandedAction.options.length > 0 && (
              <div className="space-y-2">
                {expandedAction.options.map(opt => (
                  <button
                    key={opt.id}
                    className={cn(
                      'w-full text-left p-3 rounded-md',
                      'bg-slate-900/50 hover:bg-slate-900/80',
                      'border border-slate-600/50 hover:border-slate-500/50',
                      'transition-colors'
                    )}
                  >
                    <div className="text-sm text-slate-200">{opt.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{opt.description}</div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SuggestedActionsBar;
