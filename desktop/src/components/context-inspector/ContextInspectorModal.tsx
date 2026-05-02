/**
 * ContextInspectorModal - "The Oracle's Grimoire"
 *
 * Full-screen modal showing LLM context for each call, organized by tabbed
 * categories. Replaces the 420px side drawer with a comprehensive view
 * following the LadderBenchmarksModal pattern.
 *
 * Nine tabs: Overview, System Prompt, Build Context, Game Changes,
 * Ladder Data, Mechanics, Messages, LLM Calls, Tools.
 *
 * Features:
 * - History navigation (older/newer calls)
 * - Animated tab indicator with framer-motion layoutId
 * - Section categorization routing systemContentSections to tabs
 * - Escape key to close
 * - Teal accent theme throughout
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import {
  X,
  ScrollText,
  Layers,
  FileCode2,
  Package,
  GitBranch,
  BarChart3,
  BookOpen,
  MessageCircle,
  MessageSquare,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDesktopStore } from '../../store';
import type { LLMContextDebugData, LLMContextSection } from '../../store';
import { OverviewTab } from './sections/OverviewTab';
import { SystemPromptTab } from './sections/SystemPromptTab';
import { BuildContextTab } from './sections/BuildContextTab';
import { GameChangesTab } from './sections/GameChangesTab';
import { LadderConfigTab } from './sections/LadderConfigTab';
import { MechanicsTab } from './sections/MechanicsTab';
import { MessagesTab } from './sections/MessagesTab';
import { LlmCallsTab } from './sections/LlmCallsTab';
import { ToolsTab } from './sections/ToolsTab';

// =============================================================================
// Types
// =============================================================================

interface ContextInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GrimoireTab = 'overview' | 'system-prompt' | 'build-context' | 'game-changes' | 'ladder' | 'mechanics' | 'messages' | 'llm-calls' | 'tools';

interface TabConfig {
  id: GrimoireTab;
  label: string;
  icon: React.ReactNode;
}

// =============================================================================
// Constants
// =============================================================================

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
  { id: 'system-prompt', label: 'System Prompt', icon: <FileCode2 className="w-4 h-4" /> },
  { id: 'build-context', label: 'Build Context', icon: <Package className="w-4 h-4" /> },
  { id: 'game-changes', label: 'Game Changes', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'ladder', label: 'Ladder Data', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'mechanics', label: 'Mechanics', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'messages', label: 'Messages', icon: <MessageCircle className="w-4 h-4" /> },
  { id: 'llm-calls', label: 'LLM Calls', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
];

// =============================================================================
// Helpers
// =============================================================================

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function formatPathway(pathway: string): string {
  if (!pathway) return 'Unknown';
  return pathway.charAt(0).toUpperCase() + pathway.slice(1);
}

/** Human-friendly labels for known call types. Falls back to title-casing the kebab string. */
const CALL_TYPE_LABELS: Record<string, string> = {
  'initial-analysis': 'Initial Analysis',
  'follow-up': 'Follow Up',
  'holistic-assessment': 'Holistic Assessment',
  'config-micro-agent': 'L2 Config Agent',
};

export function formatCallType(callType: string): string {
  if (!callType) return 'Unknown';
  return CALL_TYPE_LABELS[callType] ?? callType
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Categorize a systemContentSection by its label into one of the tab targets.
 */
export function categorizeSection(label: string): GrimoireTab {
  const lower = label.toLowerCase();
  if (lower.includes('full build context') || lower.includes('build context')) return 'build-context';
  if (lower.includes('game changes') || lower.includes('recent game') || lower.includes('patch') || lower.includes('path of exile changes')) return 'game-changes';
  // Ladder sections first (before config check — "Ladder Config Comparison" has both "ladder" and "config")
  if (lower.includes('ladder')) return 'ladder';
  // Mechanics reference is its own tab
  if (lower.includes('mechanics') || lower.includes('reference')) return 'mechanics';
  // Build-specific config/constraints belong with build context
  if (lower.includes('config') || lower.includes('constraint snapshot') || lower.includes('build summary') || lower.includes('user selection') || lower.includes('agent assessment')) return 'build-context';
  return 'build-context';
}

/**
 * Parse ### subsections from a large context section's content.
 */
export function parseSubsections(content: string): Array<{ label: string; content: string; tokenEstimate: number }> {
  const parts = content.split(/^### /m);
  return parts.filter((p) => p.trim()).map((part) => {
    const nlIdx = part.indexOf('\n');
    const label = nlIdx > 0 ? part.slice(0, nlIdx).trim() : part.trim();
    const body = nlIdx > 0 ? part.slice(nlIdx + 1).trim() : '';
    return {
      label,
      content: body || part.trim(),
      tokenEstimate: Math.ceil((body || part).length / 4),
    };
  });
}

/**
 * Group systemContentSections by their tab category.
 */
export function groupSectionsByTab(
  sections: LLMContextSection[]
): Record<GrimoireTab, LLMContextSection[]> {
  const grouped: Record<GrimoireTab, LLMContextSection[]> = {
    'overview': [],
    'system-prompt': [],
    'build-context': [],
    'game-changes': [],
    'ladder': [],
    'mechanics': [],
    'messages': [],
    'llm-calls': [],
    'tools': [],
  };

  for (const section of sections) {
    const tab = categorizeSection(section.label);
    grouped[tab].push(section);
  }

  return grouped;
}

// =============================================================================
// Component
// =============================================================================

export function ContextInspectorModal({ isOpen, onClose }: ContextInspectorModalProps) {
  const { contextDebugData, contextDebugHistory } = useDesktopStore(
    useShallow((s) => ({
      contextDebugData: s.contextDebugData,
      contextDebugHistory: s.contextDebugHistory,
    }))
  );

  const [activeTab, setActiveTab] = useState<GrimoireTab>('overview');
  const [historyIndex, setHistoryIndex] = useState(0);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Reset history index when new data arrives
  useEffect(() => {
    setHistoryIndex(0);
  }, [contextDebugData]);

  const currentData = useMemo<LLMContextDebugData | null>(() => {
    if (historyIndex === 0) return contextDebugData;
    if (historyIndex < contextDebugHistory.length) {
      return contextDebugHistory[historyIndex];
    }
    return contextDebugData;
  }, [contextDebugData, contextDebugHistory, historyIndex]);

  const historyCount = contextDebugHistory.length;

  const handlePrev = useCallback(() => {
    setHistoryIndex((prev) => Math.min(prev + 1, Math.max(historyCount - 1, 0)));
  }, [historyCount]);

  const handleNext = useCallback(() => {
    setHistoryIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const groupedSections = useMemo(() => {
    if (!currentData) return null;
    return groupSectionsByTab(currentData.systemContentSections);
  }, [currentData]);

  const renderTabContent = useCallback(() => {
    if (!currentData) return <EmptyState />;

    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={currentData} groupedSections={groupedSections} />;
      case 'system-prompt':
        return <SystemPromptTab data={currentData} />;
      case 'build-context':
        return <BuildContextTab sections={groupedSections?.['build-context'] ?? []} totalTokens={currentData.totalTokenEstimate} />;
      case 'game-changes':
        return <GameChangesTab sections={groupedSections?.['game-changes'] ?? []} totalTokens={currentData.totalTokenEstimate} />;
      case 'ladder':
        return <LadderConfigTab sections={groupedSections?.['ladder'] ?? []} totalTokens={currentData.totalTokenEstimate} />;
      case 'mechanics':
        return <MechanicsTab sections={groupedSections?.['mechanics'] ?? []} totalTokens={currentData.totalTokenEstimate} />;
      case 'messages':
        return <MessagesTab data={currentData} />;
      case 'llm-calls':
        return <LlmCallsTab />;
      case 'tools':
        return <ToolsTab data={currentData} />;
      default:
        return null;
    }
  }, [activeTab, currentData, groupedSections]);

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
            radial-gradient(ellipse at 50% 30%, rgba(20, 184, 166, 0.04) 0%, transparent 60%),
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
              rgba(15, 23, 35, 0.98) 0%,
              rgba(8, 15, 25, 0.99) 100%
            )
          `,
          border: '1px solid rgba(20, 184, 166, 0.12)',
          boxShadow: `
            0 0 80px rgba(0, 0, 0, 0.8),
            0 0 40px rgba(20, 184, 166, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.03)
          `,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Oracle's Grimoire - LLM Context Inspector"
      >
        {/* ===== Header ===== */}
        <div className="flex-shrink-0 border-b border-teal-900/25 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: title orb + text */}
            <div className="flex items-center gap-4">
              {/* Teal orb */}
              <div className="relative">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, rgba(45, 212, 191, 0.3) 0%, rgba(20, 184, 166, 0.15) 50%, transparent 70%)',
                    border: '1px solid rgba(45, 212, 191, 0.3)',
                    boxShadow: '0 0 24px rgba(20, 184, 166, 0.2), inset 0 0 15px rgba(45, 212, 191, 0.1)',
                  }}
                >
                  <ScrollText className="w-5 h-5 text-teal-300" />
                </div>
                {/* Floating particle */}
                <div
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-teal-400/50 animate-pulse"
                  style={{ boxShadow: '0 0 6px rgba(45, 212, 191, 0.6)' }}
                />
              </div>

              <div>
                <h2 className="font-display text-lg font-semibold text-teal-100 tracking-wider uppercase">
                  The Oracle&apos;s Grimoire
                </h2>
                <p className="text-[0.6875rem] text-teal-400/70 mt-0.5">
                  What the oracle was told
                  {currentData && (
                    <span className="text-slate-600 ml-2">
                      {formatPathway(currentData.pathway)} &bull; {formatCallType(currentData.callType)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Right: history navigation + close */}
            <div className="flex items-center gap-3">
              {/* History navigation */}
              {historyCount > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={historyIndex >= historyCount - 1}
                    className={cn(
                      'rounded-md p-1.5 transition-all duration-200',
                      historyIndex >= historyCount - 1
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-teal-400 hover:bg-teal-500/10 hover:text-teal-300'
                    )}
                    aria-label="Older call"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-[0.6875rem] text-slate-500 tabular-nums min-w-[5rem] text-center">
                    Call {historyCount - historyIndex} of {historyCount}
                  </span>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={historyIndex <= 0}
                    className={cn(
                      'rounded-md p-1.5 transition-all duration-200',
                      historyIndex <= 0
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-teal-400 hover:bg-teal-500/10 hover:text-teal-300'
                    )}
                    aria-label="Newer call"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'rounded-lg p-2.5 transition-all duration-200',
                  'text-teal-400/50 hover:text-teal-300',
                  'hover:bg-teal-500/10'
                )}
                aria-label="Close context inspector"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ===== Tab Bar ===== */}
          <div className="flex gap-1 mt-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-medium',
                  'transition-all duration-200',
                  activeTab === tab.id
                    ? 'text-teal-200 bg-teal-500/10'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                )}
              >
                <span className={cn(
                  'transition-colors',
                  activeTab === tab.id ? 'text-teal-400' : 'text-slate-600'
                )}>
                  {tab.icon}
                </span>
                {tab.label}

                {/* Active tab indicator */}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="grimoire-tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(45, 212, 191, 0.5) 50%, transparent 100%)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ===== Scrollable Content ===== */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-fantasy">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ===== Footer ===== */}
        {currentData && (
          <div className="flex-shrink-0 border-t border-teal-900/20 px-6 py-3">
            <div className="flex items-center justify-between text-[0.625rem] text-slate-600">
              <span>
                Est. total:{' '}
                <span className="text-teal-400/60 font-medium tabular-nums">
                  ~{formatTokens(currentData.totalTokenEstimate)}
                </span>
                {' '}tokens
              </span>
              <span className="flex items-center gap-2">
                <Cpu className="w-3 h-3 text-slate-700" />
                <span className="text-slate-500">{currentData.model || 'Unknown model'}</span>
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl p-8 text-center max-w-md mx-auto mt-20"
      style={{
        background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.05) 0%, transparent 100%)',
        border: '1px solid rgba(45, 212, 191, 0.15)',
      }}
    >
      <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-teal-500/10">
        <Sparkles className="w-7 h-7 text-teal-400/50" />
      </div>
      <p className="text-sm text-teal-300/70 font-display">
        No context data yet
      </p>
      <p className="text-xs text-teal-400/50 mt-2 leading-relaxed">
        Run an analysis or send a follow-up message to inspect what the oracle receives.
      </p>
    </motion.div>
  );
}
