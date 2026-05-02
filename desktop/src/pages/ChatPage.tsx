/**
 * Desktop ChatPage Component - Analysis-First Navigation
 *
 * Architecture: Three-column layout with analysis-first flow
 * - Left Panel (160px): Compact stats sidebar (collapsible)
 * - Middle Panel (flex): Mode-specific content (no top nav bar)
 * - Right Panel (320px): Context panel (Gear/Skills/Tree tabs)
 *
 * Flow:
 * 1. analyze-config: Default landing with welcome header + analysis configuration
 * 2. analyze-results: Analysis results with pathway tabs and inline chat
 * 3. improvements: Improvement cards with inline actions
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Coins, RefreshCw, Trophy, ArrowLeft, Newspaper, Map } from 'lucide-react';
import { preloadImages } from '../utils/image-preloader';
import { toast } from 'sonner';
import { normalizePathwayHistories, useDesktopStore } from '../store';
import { useDesktopChat } from '../hooks/useDesktopChat';
import { useTokenStore } from '../store/tokenSlice';
import { CREDIT_COST_USD } from '../../../shared/types/Credits';
import { cn } from '../lib/utils';
import { TokenUsageDrawer } from '../components/shared/TokenUsageDrawer';
import { LadderStatsDrawer } from '../components/shared/LadderStatsDrawer';
import { LadderBenchmarksModal } from '../components/ladder-benchmarks/LadderBenchmarksModal';
import { StashBadge } from '../components/stash-overview/StashBadge';
import { StashOverviewModal } from '../components/stash-overview/StashOverviewModal';
import { ConfigDetailPanel } from '../components/chat/ConfigDetailPanel';
import { AttributeRequirementsPanel } from '../components/chat/AttributeRequirementsPanel';
import {
  SkillsVizTab,
  TreeVizTab,
  GearVizTab,
  AtlasVizTab,
} from '../components/visualization';

// Layout components
import { ChatPageLayout } from '../components/chat/ChatPageLayout';
import { CompactStatsSidebar, type CompactStats, type BanditChoice, type MajorGod, type MinorGod } from '../components/chat/CompactStatsSidebar';

// Mode content components
import { AnalyzeMode, type AnalysisConfig } from '../components/chat/modes/AnalyzeMode';
import { PathwayCostConfirmDialog } from '../components/chat/PathwayCostConfirmDialog';

import { importBuild, callBackend } from '../services/tauri-api';
import { fetchVisualizationStream } from '../services/sse-client';
import type { BuildVisualizationResponse, PathwayType } from '../store';
import type { AnalysisFocus } from '../types/chat-modes';
import { EntityTooltipProvider } from '../contexts/EntityTooltipContext';
import { useAuthAccount } from '../hooks/useAuthAccount';
import { DiscordButton } from '../components/ui/DiscordButton';
import { VersionBadge } from '../components/ui/VersionBadge';
import { ContextInspectorButton } from '../components/shared/ContextInspectorButton';
import { ContextInspectorModal } from '../components/context-inspector';
import { useAnalysisHistoryStore } from '../store/analysisHistoryStore';
import { useLadderData } from '../hooks/useLadderData';
import { MetaIntelDrawer } from '../components/intel/MetaIntelDrawer';

// ============================================
// Types
// ============================================

type VizTab = 'gear' | 'skills' | 'tree' | 'atlas';

// ============================================
// Tab Bar Component (Context Panel)
// ============================================

interface TabBarProps {
  activeTab: VizTab;
  onTabChange: (tab: VizTab) => void;
}

function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: Array<{ id: VizTab; label: string; icon: string }> = [
    { id: 'gear', label: 'Gear', icon: 'shield' },
    { id: 'skills', label: 'Skills', icon: 'gem' },
    { id: 'tree', label: 'Tree', icon: 'tree' },
  ];

  return (
    <div className="flex panel-header relative">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            relative flex-1 px-4 py-3 text-sm font-display font-medium tracking-wide
            transition-all duration-200
            ${activeTab === tab.id
              ? 'text-amber-300 tab-metallic-active'
              : 'text-slate-400 tab-metallic hover:text-slate-200'
            }
          `}
        >
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// Header Action Components
// ============================================

/**
 * Format cost in USD with appropriate precision
 */
function formatCredits(credits: number | null): string {
  if (credits === null) return '—';
  return credits.toLocaleString('en-US');
}

function LadderBadge({
  buildCount,
  hasData,
  onClick,
}: {
  buildCount?: number;
  hasData: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={hasData ? onClick : undefined}
      className={cn(
        'group relative flex items-center gap-2 px-3 py-1.5 h-8',
        'rounded-lg',
        'transition-all duration-200',
        hasData
          ? [
              'bg-gradient-to-b from-amber-500/12 to-amber-900/8',
              'border border-amber-500/25 hover:border-amber-400/50',
              'shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_1px_3px_rgba(0,0,0,0.3)]',
              'hover:shadow-[inset_0_1px_0_rgba(251,191,36,0.12),0_1px_6px_rgba(0,0,0,0.4),0_0_12px_rgba(251,191,36,0.08)]',
              'cursor-pointer',
            ]
          : 'bg-slate-800/30 border border-slate-700/20 cursor-default opacity-40'
      )}
      title={hasData ? `View ladder benchmarks (${buildCount} builds)` : 'No ladder data — fetch from analysis screen'}
    >
      <div className="relative">
        <Trophy className={cn('w-3.5 h-3.5 relative z-10', hasData ? 'text-amber-400' : 'text-slate-600')} />
        {hasData && <div className="absolute inset-0 blur-sm bg-amber-500/30 rounded-full" />}
      </div>
      {hasData && buildCount != null && (
        <span className="text-xs font-semibold text-amber-300/90 tabular-nums">{buildCount}</span>
      )}
    </button>
  );
}

function CreditBadge({ credits, onClick }: { credits: number | null; onClick: () => void }) {
  const costUsd = useTokenStore((state) => state.totals.costUsd);
  const isDev = import.meta.env.DEV;

  const sessionCredits = Math.floor(costUsd / CREDIT_COST_USD);
  const displayText = isDev
    ? `$${costUsd < 1 ? costUsd.toFixed(3) : costUsd.toFixed(2)}`
    : formatCredits(credits);
  const label = isDev ? 'Session cost (USD)' : 'Credit balance';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 px-3 py-1.5 h-8',
        'rounded-lg',
        'bg-gradient-to-b from-slate-700/40 to-slate-800/60',
        'border border-slate-600/30 hover:border-amber-500/35',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_3px_rgba(0,0,0,0.3)]',
        'hover:shadow-[inset_0_1px_0_rgba(251,191,36,0.06),0_1px_6px_rgba(0,0,0,0.4),0_0_12px_rgba(251,191,36,0.06)]',
        'transition-all duration-200'
      )}
      title={label}
    >
      <div className="relative">
        <Coins className="w-3.5 h-3.5 text-amber-400 relative z-10" />
        <div className="absolute inset-0 blur-sm bg-amber-500/25 rounded-full" />
      </div>
      <span className="text-xs font-semibold text-amber-200/90 tabular-nums tracking-wide">
        {displayText}
      </span>
      {isDev && sessionCredits > 0 && (
        <span className="text-[0.6rem] text-amber-400/40 tabular-nums font-mono">
          {sessionCredits}c
        </span>
      )}
    </button>
  );
}


// ============================================
// Helper: Map vizData.stats to CompactStats
// ============================================

/** Map config setting keys to user-friendly labels */
const CONFIG_LABELS: Record<string, string> = {
  conditionUsingFlask: 'Flask Uptime',
  usePowerCharges: 'Power Charges',
  useFrenzyCharges: 'Frenzy Charges',
  useEnduranceCharges: 'Endurance Charges',
  buffOnslaught: 'Onslaught',
  buffFortification: 'Fortification',
  buffTailwind: 'Tailwind',
  buffUnholyMight: 'Unholy Might',
  buffAdrenaline: 'Adrenaline',
  conditionFullLife: 'Full Life',
  conditionLowLife: 'Low Life',
  conditionFullMana: 'Full Mana',
  conditionLowMana: 'Low Mana',
  enemyIsShocked: 'Shock',
  enemyIsChilled: 'Chill',
  enemyIsBlinded: 'Blind',
  enemyIsCrushed: 'Crushed',
  conditionEnemyIntimidated: 'Intimidate',
  conditionEnemyUnnerved: 'Unnerve',
  conditionEnemyCoveredInAsh: 'Covered in Ash',
  conditionEnemyCoveredInFrost: 'Covered in Frost',
  conditionEnemyPoisoned: 'Enemy Poisoned',
  conditionEnemyMaimed: 'Enemy Maimed',
  conditionEnemyHindered: 'Enemy Hindered',
  conditionEnemyBlinded: 'Enemy Blinded',
  conditionEnemyBurning: 'Enemy Burning',
  conditionEnemyBleeding: 'Enemy Bleeding',
  enemyIsBoss: 'Boss Target',
};

function mapVizToCompactStats(vizData: BuildVisualizationResponse | null): CompactStats {
  if (!vizData?.stats) {
    return {
      dps: { total: 0 },
      mainSkill: undefined,
      life: 0,
      energyShield: 0,
      effectiveHp: 0,
      armour: 0,
      evasion: 0,
      spellSuppression: 0,
      resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0, fireOverCap: 0, coldOverCap: 0, lightningOverCap: 0, chaosOverCap: 0 },
    };
  }

  const stats = vizData.stats;
  const treeStats = vizData.tree?.treeStats;

  const deriveSourceKind = (
    provenance?: 'auto_detected' | 'pob_default' | 'agent_override',
    sourceDescription?: string,
  ): 'detected' | 'baseline' | 'pob_on' | 'ai_adjusted' => {
    if (provenance === 'agent_override') return 'ai_adjusted';
    if (provenance === 'auto_detected') return 'detected';
    if (sourceDescription?.toLowerCase().includes('path of building')) return 'pob_on';
    return 'baseline';
  };

  // Hero card shows the MAIN SKILL's archetype-aware DPS (not total build DPS).
  // Total build DPS is shown in the Damage Sources breakdown section instead.
  // Prefer Pinnacle Boss values for sidebar (matches "vs Pinnacle Boss" label).
  const mainSkillDps = stats.dpsVsPinnacle ?? stats.dps ?? 0;

  return {
    dps: {
      total: mainSkillDps,
      breakdown: {
        hit: stats.hitDps,
        dot: stats.totalDotDps,
        ignite: stats.igniteDps,
        bleed: stats.bleedDps,
        poison: stats.poisonDps,
      },
      suffix: stats.dpsSuffix || undefined,
    },
    mainSkill: stats.activeSkillName || undefined,
    totalBuildDps: stats.totalBuildDps || undefined,
    skillDpsBreakdown: stats.skillDpsBreakdown?.length ? stats.skillDpsBreakdown : undefined,
    life: stats.life,
    energyShield: stats.energyShield,
    effectiveHp: stats.ehpVsPinnacle ?? stats.ehp,
    armour: stats.armour,
    evasion: stats.evasion,
    spellSuppression: stats.spellSuppressionChance,
    spellSuppressionEffect: stats.spellSuppressionEffect,
    blockChance: stats.blockChance,
    spellBlockChance: stats.spellBlockChance,
    physicalDamageReduction: stats.physicalDamageReduction,
    // Max Hit Taken
    maxHitPhysical: stats.maxHitPhysical,
    maxHitFire: stats.maxHitFire,
    maxHitCold: stats.maxHitCold,
    maxHitLightning: stats.maxHitLightning,
    maxHitChaos: stats.maxHitChaos,
    // Sustain & Recovery
    lifeRegen: stats.lifeRegen,
    lifeLeechGainRate: stats.lifeLeechGainRate,
    totalMana: stats.totalMana,
    manaUnreserved: stats.manaUnreserved,
    manaRegen: stats.manaRegen,
    energyShieldRegen: stats.energyShieldRegen,
    energyShieldRechargeRate: stats.energyShieldRechargeRate,
    netLifeRegen: stats.netLifeRegen,
    netManaRegen: stats.netManaRegen,
    // Recoup
    lifeRecoup: stats.lifeRecoup,
    energyShieldRecoup: stats.energyShieldRecoup,
    manaRecoup: stats.manaRecoup,
    // Mitigation extras
    evadeChance: stats.evadeChance,
    movementSpeedMod: stats.movementSpeedMod,
    ward: stats.ward,
    // Offense extras (use skill-specific values, not mainOutput Display variants)
    hitChance: stats.hitChance,
    critChance: stats.critChance,
    critMultiplier: stats.critMultiplier,
    attackSpeed: stats.speed,
    resistances: {
      fire: stats.fireResist,
      cold: stats.coldResist,
      lightning: stats.lightningResist,
      chaos: stats.chaosResist,
      fireOverCap: stats.fireResistOverCap ?? 0,
      coldOverCap: stats.coldResistOverCap ?? 0,
      lightningOverCap: stats.lightningResistOverCap ?? 0,
      chaosOverCap: stats.chaosResistOverCap ?? 0,
    },
    // Attributes from stats (total) and treeStats (tree breakdown)
    attributes: stats.strength || stats.dexterity || stats.intelligence ? {
      strength: stats.strength || 0,
      dexterity: stats.dexterity || 0,
      intelligence: stats.intelligence || 0,
    } : undefined,
    treeAttributes: treeStats?.strBase || treeStats?.dexBase || treeStats?.intBase ? {
      strength: treeStats.strBase || 0,
      dexterity: treeStats.dexBase || 0,
      intelligence: treeStats.intBase || 0,
    } : undefined,
    // User-facing: show what configs ARE active and why
    configAssumptions: vizData.configPreflight ? [
      // Active configs (hasSource) — build has a source for these, with measured DPS/EHP impact
      ...(vizData.configPreflight.hasSource?.map(d => ({
        label: d.label,
        source: d.sourceDescription || d.category || 'build',
        dpsPercent: d.dpsPercent,
        ehpPercent: d.ehpPercent,
        category: d.category,
        status: 'active' as const,
        provenance: d.provenance,
        sourceKind: deriveSourceKind(d.provenance, d.sourceDescription),
        configKey: d.configVar ?? d.label,
      })) ?? []),
      // Already active in PoB baseline — no delta to show, but include reasoning if available
      ...(vizData.configPreflight.alreadyActive?.map(d => ({
        label: d.label,
        source: d.sourceDescription ?? 'baseline',
        category: d.category,
        status: 'active' as const,
        provenance: d.provenance,
        sourceKind: deriveSourceKind(d.provenance, d.sourceDescription),
        configKey: d.configVar ?? d.label,
      })) ?? []),
    ] : (
      // Fallback to old configRecommendation reasoning
      vizData.configRecommendation?.reasoning
        ?.filter((r) => r.value === true || (r.setting === 'enemyIsBoss' && r.value !== 'None'))
        .map((r) => ({
          label: CONFIG_LABELS[r.setting] || r.setting,
          source: r.reason,
        })) ?? undefined
    ),
    // Untapped potential — configs with big DPS/EHP impact but no source in the build
    configOpportunities: vizData.configPreflight?.highImpactAvailable?.map(d => ({
      label: d.label,
      category: d.category,
      dpsPercent: d.dpsPercent,
      ehpPercent: d.ehpPercent,
      potentialSources: d.potentialSources,
      sourceKind: d.potentialSources?.length ? 'possible_source' : 'no_source',
    })) ?? undefined,
    // Ladder/meta config gaps — configs common in top builds that this build lacks
    ladderConfigGaps: vizData.configRecommendation?.ladderConfigGaps ?? undefined,
  };
}

// ============================================
// Main ChatPage Component
// ============================================

export function ChatPage() {
  const navigate = useNavigate();

  // Store state - UI mode (Analysis-First Navigation)
  const activeUIMode = useDesktopStore((s) => s.activeUIMode);
  const setActiveUIMode = useDesktopStore((s) => s.setActiveUIMode);
  const analysisConfig = useDesktopStore((s) => s.analysisConfig);
  const setAnalysisConfig = useDesktopStore((s) => s.setAnalysisConfig);
  const pathwayContext = useDesktopStore((s) => s.pathwayContext);
  const setPathwayContext = useDesktopStore((s) => s.setPathwayContext);

  // Store state - Analysis history (session switching)
  const analysisHistory = useDesktopStore((s) => s.analysisHistory);
  const addAnalysisEntry = useDesktopStore((s) => s.addAnalysisEntry);
  const setActiveAnalysisEntry = useDesktopStore((s) => s.setActiveAnalysisEntry);
  const removeAnalysisEntry = useDesktopStore((s) => s.removeAnalysisEntry);
  const getActiveAnalysisEntry = useDesktopStore((s) => s.getActiveAnalysisEntry);
  const activePathwayTab = useDesktopStore((s) => s.activePathwayTab);
  const setActivePathwayTab = useDesktopStore((s) => s.setActivePathwayTab);
  const setActivePathway = useDesktopStore((s) => s.setActivePathway);
  const rawPathwayHistories = useDesktopStore((s) => s.pathwayHistories);
  const pathwayHistories = useMemo(
    () => normalizePathwayHistories(rawPathwayHistories),
    [rawPathwayHistories],
  );
  const addPathwayMessage = useDesktopStore((s) => s.addPathwayMessage);

  // Store state - build and viz
  const currentBuild = useDesktopStore((s) => s.currentBuild);
  const vizData = useDesktopStore((s) => s.vizData);
  const setVizData = useDesktopStore((s) => s.setVizData);
  const vizStreamError = useDesktopStore((s) => s.vizStreamError);
  const appendVizStep = useDesktopStore((s) => s.appendVizStep);
  const clearVizSteps = useDesktopStore((s) => s.clearVizSteps);
  const gearSlotRatings = useDesktopStore((s) => s.gearSlotRatings);
  const activeUnifiedTab = useDesktopStore((s) => s.activeUnifiedTab);

  // Atlas tree state
  const gggAccessToken = useDesktopStore((s) => s.gggAccessToken);
  const atlasSummary = useDesktopStore((s) => s.atlasSummary);
  const atlasNamedTrees = useDesktopStore((s) => s.atlasNamedTrees);
  const atlasError = useDesktopStore((s) => s.atlasError);
  const setAtlasData = useDesktopStore((s) => s.setAtlasData);
  const setAtlasError = useDesktopStore((s) => s.setAtlasError);

  // Local state
  const [activeTab, setActiveTab] = useState<VizTab>('gear');
  const [isLoadingViz, setIsLoadingViz] = useState(true);
  const [expandedSlots, setExpandedSlots] = useState<string[]>([]);
  const [isTokenDrawerOpen, setIsTokenDrawerOpen] = useState(false);
  const [isContextInspectorOpen, setIsContextInspectorOpen] = useState(false);
  const [isLadderDrawerOpen, setIsLadderDrawerOpen] = useState(false);
  const [isLadderModalOpen, setIsLadderModalOpen] = useState(false);
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [isAttributePanelOpen, setIsAttributePanelOpen] = useState(false);
  const [isMetaIntelOpen, setIsMetaIntelOpen] = useState(false);
  const [banditChoice, setBanditChoice] = useState<BanditChoice>('None');
  const [isBanditLoading, setIsBanditLoading] = useState(false);
  const [pantheonMajor, setPantheonMajor] = useState<MajorGod>('None');
  const [pantheonMinor, setPantheonMinor] = useState<MinorGod>('None');
  const [isPantheonLoading, setIsPantheonLoading] = useState(false);
  // Pathway tab → cost confirm dialog: which pathway the user wants to start
  const [pendingPathwayConfirm, setPendingPathwayConfirm] = useState<string | null>(null);
  // Pathway queue: pathways confirmed via tab click, waiting for current analysis to finish
  const [pathwayQueue, setPathwayQueue] = useState<AnalysisFocus[]>([]);

  // Ladder data — auto-fetch is gated on vizData being loaded to prevent
  // concurrent GGG API calls (import + ladder fetch) that cause rate limiting.
  // Status check runs immediately; actual fetch waits for viz + 5s buffer.
  const ladder = useLadderData(currentBuild?.buildId ?? null, {
    skill: vizData?.stats?.activeSkillName ?? undefined,
    ascendancy: currentBuild?.ascendancy,
    level: currentBuild?.level,
    ready: !!vizData,
  });
  const ladderStats = ladder.stats;
  const isLadderFetching = ladder.isFetching;

  // Auth & credit state
  const authAccount = useAuthAccount();

  // Chat hook
  const {
    streamingContent,
    startAnalysis,
    isGeneratingInitialAnalysis,
    suggestedQuestions,
    sendMessage,
    isSending,
    cancelAllStreams,
    analysisMessageParts,
    cancelInitialAnalysis,
    errorCode,
    launchSynthesis,
    streamingPathways,
    streamingContentByPathway,
    streamingStatus,
    analysisSessionId,
    liveTradeSearch,
  } = useDesktopChat();

  // Synthesis state from store
  const completedPathways = useDesktopStore((s) => s.completedPathways);
  const isSynthesisUnlocked = useDesktopStore((s) => s.isSynthesisUnlocked);
  const isSynthesisRunning = useDesktopStore((s) => s.isSynthesisRunning);

  // Store actions for clearing history
  const clearPathwayHistory = useDesktopStore((s) => s.clearPathwayHistory);

  // Credit balance from store
  const creditBalance = useTokenStore((state) => state.creditBalance);

  // Abort all active SSE streams when ChatPage unmounts (e.g. navigation away).
  // This prevents orphaned streams from writing to stale state after unmount.
  useEffect(() => {
    return () => {
      cancelAllStreams();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global ESC handler to cancel follow-up chat streams only
  // Initial analysis cannot be cancelled — it always runs to completion
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSending && !isGeneratingInitialAnalysis) {
        e.preventDefault();
        cancelAllStreams();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isGeneratingInitialAnalysis, isSending, cancelAllStreams]);

  // Sync store's activeUnifiedTab to local viz tab (e.g. "Show on Tree" button)
  useEffect(() => {
    if (activeUnifiedTab === 'gear' || activeUnifiedTab === 'skills' || activeUnifiedTab === 'tree') {
      setActiveTab(activeUnifiedTab);
    }
  }, [activeUnifiedTab]);

  // Initialize bandit from vizData config when it first loads
  useEffect(() => {
    if (vizData?.config?.bandit) {
      const b = vizData.config.bandit as BanditChoice;
      if (b === 'None' || b === 'Alira' || b === 'Oak' || b === 'Kraityn') {
        setBanditChoice(b);
      }
    }
  }, [vizData?.config?.bandit]);

  // Initialize pantheon from vizData config when it first loads
  useEffect(() => {
    if (vizData?.config?.pantheon) {
      const p = vizData.config.pantheon;
      if (p.major) setPantheonMajor(p.major as MajorGod);
      if (p.minor) setPantheonMinor(p.minor as MinorGod);
    }
  }, [vizData?.config?.pantheon]);

  // Fetch atlas passives when we have an OAuth token but no atlas data yet
  useEffect(() => {
    if (!gggAccessToken || atlasSummary) return;
    let cancelled = false;
    setAtlasError(null);
    (async () => {
      try {
        const { importAtlasPassives } = await import('../services/tauri-api');
        // Use "Mirage" as the current league
        const result = await importAtlasPassives(gggAccessToken, 'Mirage');
        if (!cancelled) {
          setAtlasData({
            atlasId: result.atlasId,
            summary: result.summary,
            namedTrees: result.state.atlasPassiveTrees,
          });
        }
      } catch (err) {
        console.warn('[ChatPage] Atlas import failed (best-effort):', err);
        if (!cancelled) {
          const msg = (err as Error).message || '';
          // 403 typically means the OAuth token was issued before the
          // account:league_accounts scope was added — user needs to re-login
          const needsReauth = msg.includes('403');
          setAtlasError(
            needsReauth
              ? 'Atlas requires updated permissions. Please log out and log in again with PoE.'
              : msg || 'Failed to load atlas data'
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [gggAccessToken, atlasSummary, setAtlasData, setAtlasError]);

  // Switch to atlas tab when an AtlasPill is clicked (fired via custom window event)
  useEffect(() => {
    const handler = () => setActiveTab('atlas');
    window.addEventListener('switch-to-atlas-tab', handler);
    return () => window.removeEventListener('switch-to-atlas-tab', handler);
  }, []);

  // Auto-reimport build when backend returns 404 (build expired or server restarted).
  // Returns the new buildId, or null if reimport failed.
  const reimportBuildIfExpired = useCallback(async (): Promise<string | null> => {
    const pobCode = currentBuild?.pobCode;
    if (!pobCode) return null;
    try {
      console.log('[ChatPage] Build not found in backend, auto-reimporting for config update...');
      const importResult = await importBuild(pobCode);
      useDesktopStore.setState((s) => ({
        currentBuild: s.currentBuild ? { ...s.currentBuild, buildId: importResult.buildId } : s.currentBuild,
      }));
      return importResult.buildId;
    } catch (reimportError) {
      console.error('Failed to reimport build:', reimportError);
      return null;
    }
  }, [currentBuild?.pobCode]);

  // Handle bandit change — call backend, refresh stats in sidebar
  const handleBanditChange = useCallback(async (newBandit: BanditChoice) => {
    let buildId = currentBuild?.buildId;
    if (!buildId) return;

    setIsBanditLoading(true);
    setBanditChoice(newBandit); // Optimistic update
    try {
      const doPatch = (id: string) => callBackend<{
        buildId: string;
        bandit: string;
        stats: {
          fireResist: number;
          coldResist: number;
          lightningResist: number;
          chaosResist: number;
          fireResistOverCap: number;
          coldResistOverCap: number;
          lightningResistOverCap: number;
          chaosResistOverCap: number;
          life: number;
          energyShield: number;
          movementSpeedMod: number;
          ehp?: number;
          dps?: number;
          maxHitPhys?: number;
          maxHitFire?: number;
          maxHitCold?: number;
          maxHitLight?: number;
          maxHitChaos?: number;
        };
      }>(`/api/v1/builds/${id}/bandit`, 'PATCH', { bandit: newBandit });

      let result;
      try {
        result = await doPatch(buildId);
      } catch (firstError) {
        const msg = firstError instanceof Error ? firstError.message : String(firstError);
        if (msg.includes('404') || msg.includes('BUILD_NOT_FOUND')) {
          const newId = await reimportBuildIfExpired();
          if (newId) {
            buildId = newId;
            result = await doPatch(newId);
          } else {
            throw firstError;
          }
        } else {
          throw firstError;
        }
      }

      // Update vizData stats with refreshed values from PoB (Pinnacle boss)
      if (vizData && result.stats) {
        const s = result.stats;
        const updatedVizData = {
          ...vizData,
          stats: {
            ...vizData.stats,
            fireResist: s.fireResist,
            coldResist: s.coldResist,
            lightningResist: s.lightningResist,
            chaosResist: s.chaosResist,
            fireResistOverCap: s.fireResistOverCap,
            coldResistOverCap: s.coldResistOverCap,
            lightningResistOverCap: s.lightningResistOverCap,
            chaosResistOverCap: s.chaosResistOverCap,
            life: s.life,
            energyShield: s.energyShield,
            // Update EHP, DPS, and max hit from Pinnacle calcs
            ...(s.ehp != null && { ehpVsPinnacle: s.ehp, ehp: s.ehp }),
            ...(s.dps != null && { dpsVsPinnacle: s.dps }),
            ...(s.maxHitPhys != null && { maxHitPhysical: s.maxHitPhys }),
            ...(s.maxHitFire != null && { maxHitFire: s.maxHitFire }),
            ...(s.maxHitCold != null && { maxHitCold: s.maxHitCold }),
            ...(s.maxHitLight != null && { maxHitLightning: s.maxHitLight }),
            ...(s.maxHitChaos != null && { maxHitChaos: s.maxHitChaos }),
          },
          config: {
            activeSettings: [],
            ...vizData.config,
            bandit: newBandit,
          },
        };
        setVizData(updatedVizData);
      }

      const refreshResult = await fetchVisualizationStream(buildId, () => {});
      if (refreshResult.ok) {
        setVizData(refreshResult.data);
      } else {
        console.warn('Failed to refresh visualization after bandit change:', refreshResult.error);
      }
    } catch (error) {
      console.error('Failed to set bandit:', error);
      // Revert optimistic update
      setBanditChoice(vizData?.config?.bandit as BanditChoice ?? 'None');
      toast.error('Failed to update bandit choice');
    } finally {
      setIsBanditLoading(false);
    }
  }, [currentBuild?.buildId, vizData, setVizData, reimportBuildIfExpired]);

  // Handle pantheon change — call backend, refresh stats in sidebar
  const handlePantheonChange = useCallback(async (newMajor?: MajorGod, newMinor?: MinorGod) => {
    let buildId = currentBuild?.buildId;
    if (!buildId) return;

    setIsPantheonLoading(true);
    // Optimistic update
    if (newMajor) setPantheonMajor(newMajor);
    if (newMinor) setPantheonMinor(newMinor);
    try {
      const body: Record<string, string> = {};
      if (newMajor) body.major = newMajor;
      if (newMinor) body.minor = newMinor;

      const doPatch = (id: string) => callBackend<{
        buildId: string;
        major: string;
        minor: string;
        stats: {
          fireResist: number;
          coldResist: number;
          lightningResist: number;
          chaosResist: number;
          fireResistOverCap: number;
          coldResistOverCap: number;
          lightningResistOverCap: number;
          chaosResistOverCap: number;
          life: number;
          energyShield: number;
          movementSpeedMod: number;
          ehp?: number;
          dps?: number;
          maxHitPhys?: number;
          maxHitFire?: number;
          maxHitCold?: number;
          maxHitLight?: number;
          maxHitChaos?: number;
        };
      }>(`/api/v1/builds/${id}/pantheon`, 'PATCH', body);

      let result;
      try {
        result = await doPatch(buildId);
      } catch (firstError) {
        const msg = firstError instanceof Error ? firstError.message : String(firstError);
        if (msg.includes('404') || msg.includes('BUILD_NOT_FOUND')) {
          const newId = await reimportBuildIfExpired();
          if (newId) {
            buildId = newId;
            result = await doPatch(newId);
          } else {
            throw firstError;
          }
        } else {
          throw firstError;
        }
      }

      // Update vizData stats with refreshed values from PoB (Pinnacle boss)
      if (vizData && result.stats) {
        const s = result.stats;
        const updatedVizData = {
          ...vizData,
          stats: {
            ...vizData.stats,
            fireResist: s.fireResist,
            coldResist: s.coldResist,
            lightningResist: s.lightningResist,
            chaosResist: s.chaosResist,
            fireResistOverCap: s.fireResistOverCap,
            coldResistOverCap: s.coldResistOverCap,
            lightningResistOverCap: s.lightningResistOverCap,
            chaosResistOverCap: s.chaosResistOverCap,
            life: s.life,
            energyShield: s.energyShield,
            // Update EHP, DPS, and max hit from Pinnacle calcs
            ...(s.ehp != null && { ehpVsPinnacle: s.ehp, ehp: s.ehp }),
            ...(s.dps != null && { dpsVsPinnacle: s.dps }),
            ...(s.maxHitPhys != null && { maxHitPhysical: s.maxHitPhys }),
            ...(s.maxHitFire != null && { maxHitFire: s.maxHitFire }),
            ...(s.maxHitCold != null && { maxHitCold: s.maxHitCold }),
            ...(s.maxHitLight != null && { maxHitLightning: s.maxHitLight }),
            ...(s.maxHitChaos != null && { maxHitChaos: s.maxHitChaos }),
          },
          config: {
            activeSettings: [],
            ...vizData.config,
            pantheon: {
              major: newMajor ?? pantheonMajor,
              minor: newMinor ?? pantheonMinor,
            },
          },
        };
        setVizData(updatedVizData);
      }

      const refreshResult = await fetchVisualizationStream(buildId, () => {});
      if (refreshResult.ok) {
        setVizData(refreshResult.data);
      } else {
        console.warn('Failed to refresh visualization after pantheon change:', refreshResult.error);
      }
    } catch (error) {
      console.error('Failed to set pantheon:', error);
      // Revert optimistic update
      const p = vizData?.config?.pantheon;
      setPantheonMajor((p?.major as MajorGod) ?? 'None');
      setPantheonMinor((p?.minor as MinorGod) ?? 'None');
      toast.error('Failed to update pantheon choice');
    } finally {
      setIsPantheonLoading(false);
    }
  }, [currentBuild?.buildId, vizData, setVizData, pantheonMajor, pantheonMinor, reimportBuildIfExpired]);

  // Compute compact stats from vizData
  const compactStats = useMemo(() => mapVizToCompactStats(vizData), [vizData]);

  // Preload all icon images into browser cache as soon as vizData arrives
  useEffect(() => {
    if (!vizData) return;
    const urls: string[] = [];

    // Gem icons from skill groups
    for (const group of vizData.skills.groups) {
      for (const gem of group.gemList ?? []) {
        if (gem.iconUrl) urls.push(gem.iconUrl);
      }
    }

    // Gear item icons
    for (const item of vizData.items) {
      if (item.displayInfo?.iconUrl) urls.push(item.displayInfo.iconUrl);
    }

    if (urls.length > 0) preloadImages(urls);
  }, [vizData]);

  // Extract attribute requirements data for the panel
  const attributeRequirements = vizData?.attributeRequirements ?? null;

  // Handle viz stream completion — persist vizData to the active history snapshot
  // so restoring "imported — not yet analyzed" sessions doesn't re-trigger
  // the visualization pipeline.
  const handleVizComplete = useCallback((response: BuildVisualizationResponse) => {
    setVizData(response);
    // Persist vizData and token usage to the active history snapshot so session
    // restore can skip the visualization pipeline and show correct ledger data.
    const activeSnapId = useAnalysisHistoryStore.getState().activeSnapshotId;
    if (activeSnapId) {
      const tokenState = useTokenStore.getState();
      useAnalysisHistoryStore.getState().upsertSnapshot(activeSnapId, {
        vizData: response,
        tokenEntries: tokenState.entries,
        tokenTotals: tokenState.totals,
        creditsUsed: tokenState.creditsUsedSession,
      });
    }
  }, [setVizData]);

  // Dedup lock: prevents multiple concurrent loadVizData calls from racing
  const vizLoadingLockRef = useRef(false);

  // Reusable vizData loader — called on build change and after ladder fetch completes.
  // Uses sequential result-based flow (no async callbacks) to avoid race conditions.
  const loadVizData = useCallback(async () => {
    if (!currentBuild?.buildId) return;
    // Skip if vizData was already restored from snapshot (double-check in case effect fired early)
    if (useDesktopStore.getState().vizData) return;
    // Prevent concurrent calls (e.g. buildId changes racing with effect re-fires)
    if (vizLoadingLockRef.current) return;
    vizLoadingLockRef.current = true;

    setIsLoadingViz(true);
    clearVizSteps();

    try {
    const result = await fetchVisualizationStream(
      currentBuild.buildId,
      (step) => appendVizStep(step),
    );

    if (result.ok) {
      handleVizComplete(result.data);
      setIsLoadingViz(false);
      return;
    }

    // Handle errors — check for 404 (build expired) with auto-reimport
    if (result.error === 'cancelled') {
      setIsLoadingViz(false);
      return;
    }

    const is404 = result.httpStatus === 404 ||
      result.error.includes('BUILD_NOT_FOUND');

    if (is404 && currentBuild.pobCode) {
      console.log('[ChatPage] Build not found in backend, auto-reimporting...');
      toast.info('Reloading build data...');
      clearVizSteps();

      try {
        const importResult = await importBuild(currentBuild.pobCode);
        // Update store with new buildId but DON'T trigger the useEffect re-run
        // by using the result directly instead of going through setBuild
        const retryResult = await fetchVisualizationStream(
          importResult.buildId,
          (step) => appendVizStep(step),
        );

        if (retryResult.ok) {
          // Update buildId without full setBuild reset (which wipes vizData + triggers effect loop).
          // Only patch currentBuild.buildId so future calls use the new ID.
          useDesktopStore.setState((s) => ({
            currentBuild: s.currentBuild ? { ...s.currentBuild, buildId: importResult.buildId } : s.currentBuild,
          }));
          handleVizComplete(retryResult.data);
          toast.success('Build reloaded successfully');
        } else {
          console.error('Retry visualization failed:', retryResult.error);
          toast.error('Failed to reload build. Please re-import from the home page.');
        }
      } catch (reimportError) {
        console.error('Failed to reimport build:', reimportError);
        toast.error('Failed to reload build. Please re-import from the home page.');
      }
    } else {
      console.error('Visualization stream error:', result.error);
      toast.error('Failed to load build visualization');
    }

    setIsLoadingViz(false);
    } finally {
      vizLoadingLockRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBuild?.buildId, currentBuild?.pobCode, setVizData, clearVizSteps, appendVizStep, handleVizComplete]);

  // Load visualization data when build changes.
  // Ref guard prevents React StrictMode double-mount from firing two parallel requests.
  // Skip if vizData is already populated (e.g. restored from analysis history snapshot).
  const vizLoadBuildIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Skip fetch if vizData was already restored from a snapshot — this check
    // must come BEFORE the ref update so that background reimport buildId patches
    // (which change currentBuild.buildId without clearing vizData) don't re-trigger.
    if (useDesktopStore.getState().vizData) {
      // Still update the ref so future real build changes are detected
      vizLoadBuildIdRef.current = currentBuild?.buildId ?? null;
      // vizData was restored from snapshot — mark loading as complete so the
      // config UI isn't blocked behind the BuildLoadingSteps gate.
      setIsLoadingViz(false);
      return;
    }
    if (vizLoadBuildIdRef.current === currentBuild?.buildId) return;
    vizLoadBuildIdRef.current = currentBuild?.buildId ?? null;
    loadVizData();
  }, [loadVizData, currentBuild?.buildId]);

  // Re-fetch vizData after ladder fetch completes so config gaps get computed
  const prevLadderFetchingRef = useRef(false);
  useEffect(() => {
    // Detect transition from fetching → done
    if (prevLadderFetchingRef.current && !isLadderFetching && !vizData) {
      loadVizData();
    }
    prevLadderFetchingRef.current = isLadderFetching;
  }, [isLadderFetching, loadVizData, vizData]);

  // Handle sending an inline chat message from analysis results view
  const handleInlineChatMessage = useCallback(
    async (message: string) => {
      await sendMessage(message);
    },
    [sendMessage]
  );

  // Handle starting analysis (for AnalyzeMode)
  // Uses unified analyze-stream pathway agents.
  const handleStartAnalysis = useCallback(async () => {
    if (isGeneratingInitialAnalysis) {
      // Cancel the running analysis before starting a new one
      cancelInitialAnalysis();
      // Give the backend a moment to release the mutex after the SSE connection closes
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    wasCancelledRef.current = false;

    // Read fresh config from store — the closure value may be stale when called
    // synchronously after a store update.
    const currentConfig = useDesktopStore.getState().analysisConfig;

    // Filter out already-completed pathways so we only re-run what's needed
    const completedFocuses = [
      ...completedPathways,
    ];
    const effectiveFocus = currentConfig.focus.filter(
      (f) => !completedFocuses.includes(f as any)
    );

    // Snapshot config at analysis start so the completion effect captures the correct focus/label.
    // Always use the FULL original focus (not effectiveFocus) so the snapshot label/focus
    // reflects the entire analysis, not just the resumed subset of pathways.
    analysisConfigSnapshotRef.current = { ...currentConfig };

    // Immediately switch to results mode so user sees tool steps, chat input, back button
    setActiveUIMode('analyze-results');

    // Clear pathway histories for pathways that don't have interrupted content.
    // On continuation, interrupted pathways keep their existing tool cards
    // so the user sees prior results alongside new ones after the separator.
    for (const focus of effectiveFocus) {
      if (focus === 'qa' || (focus as string) === 'synthesis') continue;
      const pw = focus as PathwayType | 'unified';
      const hasInterruptedContent = (pathwayHistories[pw]?.length ?? 0) > 0;
      if (!hasInterruptedContent) {
        clearPathwayHistory(pw);
      }
    }

    // Set active pathway tab to first selected focus area so streaming parts are visible
    // (pathway filter in AnalyzeMode matches parts by activePathwayTab)
    const hasCustomPrompt = currentConfig.customPrompt.trim().length > 0;
    const tabPriority = ['qa', 'unified', 'gear', 'skills', 'tree'] as const;
    const initialFocus = hasCustomPrompt ? ['qa', ...effectiveFocus] : effectiveFocus;
    const firstTab = tabPriority.find(p => initialFocus.includes(p));
    if (firstTab) {
      setActivePathwayTab(firstTab);
      if (firstTab === 'unified') {
        setActivePathway('unified');
      } else if (firstTab !== 'qa') {
        setActivePathway(firstTab);
      } else {
        setActivePathway(null);
      }
    }

    const customPrompt = currentConfig.customPrompt.trim();
    await startAnalysis(customPrompt.length > 0 ? customPrompt : undefined);
  }, [analysisConfig, completedPathways, pathwayHistories, startAnalysis, setActivePathwayTab, setActivePathway, clearPathwayHistory, isGeneratingInitialAnalysis, cancelInitialAnalysis]);

  // Auto-start queued pathways when current analysis finishes.
  // Watches for isGeneratingInitialAnalysis transitioning from true → false.
  const prevIsAnalyzingRef = useRef(isGeneratingInitialAnalysis);
  useEffect(() => {
    const wasAnalyzing = prevIsAnalyzingRef.current;
    prevIsAnalyzingRef.current = isGeneratingInitialAnalysis;

    if (wasAnalyzing && !isGeneratingInitialAnalysis && pathwayQueue.length > 0) {
      const toStart = [...pathwayQueue];
      setPathwayQueue([]);

      setAnalysisConfig({ focus: toStart });
      handleStartAnalysis();
    }
  }, [isGeneratingInitialAnalysis, pathwayQueue, setAnalysisConfig, handleStartAnalysis]);

  // Handle going back to analysis configuration
  const handleBackToConfig = useCallback(() => {
    // Just switch the view — do NOT cancel analysis.
    // Analysis continues streaming in the background.
    // User can cancel explicitly via Escape or the Cancel Analysis button.
    setActiveUIMode('analyze-config');
    setPathwayContext(null);
  }, [setActiveUIMode, setPathwayContext]);

  // Handle viewing existing results (from config page)
  const handleViewResults = useCallback(() => {
    // Set the active tab to the first pathway that has content, so the user
    // doesn't land on an empty tab.
    const tabPriority: AnalysisFocus[] = ['unified', 'qa', 'gear', 'skills', 'tree'];
    const available = analysisHistory.entries.flatMap(e => e.focus);
    const firstAvailable = tabPriority.find(p => available.includes(p));
    if (firstAvailable) {
      setActivePathwayTab(firstAvailable);
      if (firstAvailable === 'unified') {
        setActivePathway('unified');
      } else if (firstAvailable !== 'qa') {
        setActivePathway(firstAvailable);
      } else {
        setActivePathway(null);
      }
    }
    setActiveUIMode('analyze-results');
  }, [setActiveUIMode, setActivePathwayTab, setActivePathway, analysisHistory.entries]);

  // Handle pathway tab changes
  const handlePathwayTabChange = useCallback((tab: AnalysisFocus) => {
    setActivePathwayTab(tab);
    if (tab === 'unified') {
      setActivePathway('unified');
    } else if (tab !== 'qa' && (tab as string) !== 'synthesis') {
      setActivePathway(tab as PathwayType);
    } else {
      setActivePathway(null);
    }

    const hasCompletedContent =
      analysisHistory.entries.some((entry) => entry.focus.includes(tab))
      || (tab === 'unified' && pathwayHistories.unified.length > 0);

    if (activeUIMode === 'analyze-config' && (isGeneratingInitialAnalysis || streamingPathways.has(tab) || hasCompletedContent)) {
      setActiveUIMode('analyze-results');
    }
  }, [
    setActivePathwayTab,
    setActivePathway,
    analysisHistory.entries,
    activeUIMode,
    isGeneratingInitialAnalysis,
    streamingPathways,
    setActiveUIMode,
  ]);

  // Handle user clicking an unlocked-but-not-yet-analyzed pathway tab → show cost confirm
  const handlePathwayUnlockedClick = useCallback((pathway: AnalysisFocus) => {
    setPendingPathwayConfirm(pathway);
  }, []);

  // Handle confirming the cost dialog → start or queue single-pathway analysis
  const handlePathwayConfirmRun = useCallback(() => {
    if (!pendingPathwayConfirm) return;
    const pathway = pendingPathwayConfirm as AnalysisFocus;
    setPendingPathwayConfirm(null);

    if (isGeneratingInitialAnalysis) {
      // Queue — will auto-start when current analysis finishes
      setPathwayQueue(prev => [...new Set([...prev, pathway])]);
    } else {
      // Start immediately
      setAnalysisConfig({ focus: [pathway] });
      handleStartAnalysis();
    }
  }, [pendingPathwayConfirm, isGeneratingInitialAnalysis, setAnalysisConfig, handleStartAnalysis]);

  // Generate label for analysis entry based on config
  const generateAnalysisLabel = useCallback((config: AnalysisConfig): string => {
    // If custom prompt only (no focus areas), label it as Q&A
    if (config.focus.length === 0 && config.customPrompt.trim().length > 0) {
      return 'Q&A';
    }
    if (['skills', 'gear', 'tree'].every((focus) => config.focus.includes(focus as AnalysisFocus))) {
      return 'Full Analysis';
    }
    if (config.focus.length === 1) {
      const labels: Record<string, string> = {
        unified: 'Unified',
        skills: 'Skills',
        gear: 'Gear',
        tree: 'Tree',
        qa: 'Q&A',
      };
      return labels[config.focus[0]] || 'Analysis';
    }
    // 2 areas
    return config.focus.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(' + ');
  }, []);

  // Track if we were generating analysis (to detect transition from generating → done)
  const wasGeneratingRef = useRef(false);
  const wasCancelledRef = useRef(false);
  const analysisConfigSnapshotRef = useRef(analysisConfig);

  // Capture analysis to history when streaming completes and transition to results
  useEffect(() => {
    // Track when we start generating
    if (isGeneratingInitialAnalysis) {
      wasGeneratingRef.current = true;
    }

    // When initial analysis streaming finishes (was generating → not generating), capture the entry.
    // This must run regardless of which UI mode the user is viewing — they may have navigated
    // back to config during streaming, and we still need to persist the completed results
    // so "View Results" stays available.
    if (wasGeneratingRef.current && !isGeneratingInitialAnalysis && streamingContent) {
      const isCancelled = wasCancelledRef.current;
      // Use the snapshot captured at analysis start, not the live config (which user may have changed during streaming)
      const snapshotConfig = analysisConfigSnapshotRef.current;
      const hasCustomPrompt = snapshotConfig.customPrompt.trim().length > 0;

      // Build the focus array for this entry
      // If user typed a custom prompt, ALWAYS include 'qa' - their question should be answered
      // Q&A goes first in the array so it becomes the active tab
      let entryFocus: AnalysisFocus[] = [];
      if (hasCustomPrompt) {
        entryFocus.push('qa');
      }
      // Add any selected pathway focus areas after Q&A
      entryFocus.push(...snapshotConfig.focus);

      // Extract per-pathway content from pathway-tagged message parts
      const pathwayContent: Record<string, string> = {};
      for (const part of analysisMessageParts) {
        if (part.type === 'text' && part.pathway) {
          pathwayContent[part.pathway] = (pathwayContent[part.pathway] || '') + part.content;
        }
      }
      // Clean each pathway's content (strip suggested_questions/improvements blocks)
      for (const key of Object.keys(pathwayContent)) {
        pathwayContent[key] = pathwayContent[key]
          .replace(/```suggested_questions[\s\S]*?```/g, '')
          .replace(/```improvements_json[\s\S]*?```/g, '')
          .trim();
      }

      // Seed pathway histories with analysis content so follow-up chats have context.
      // This enables "go ahead" after ESC cancellation — the model sees partial analysis in history.
      // Skip pathways already stored by pathway_complete/complete handlers in useDesktopChat.
      for (const focus of snapshotConfig.focus) {
        if (focus === 'qa' || (focus as string) === 'synthesis') continue;
        if (completedPathways.includes(focus as PathwayType)) continue;
        const content = pathwayContent[focus];
        const pathwayPartsForFocus = analysisMessageParts.filter((part) => (
          'pathway' in part && part.pathway === focus
        ));
        if (content) {
          addPathwayMessage(focus, {
            id: `analysis-${Date.now()}-${focus}`,
            role: 'assistant',
            content,
            timestamp: Date.now(),
            parts: pathwayPartsForFocus.length > 0 ? pathwayPartsForFocus : undefined,
          });
        }
      }

      // Save to analysis history for tab display.
      // For cancelled analyses, still save so completed pathways' results are visible,
      // but use pathway-specific content only (never the mixed global streamingContent).
      // Merge with any pathwayContent from previously completed pathways (resume scenario).
      const currentEntries = useDesktopStore.getState().analysisHistory.entries;
      const prevEntry = currentEntries.length > 0
        ? currentEntries[currentEntries.length - 1]
        : undefined;
      const mergedEntryPathwayContent = {
        ...(prevEntry?.pathwayContent ?? {}),
        ...pathwayContent,
      };
      const analysisLabel = generateAnalysisLabel(snapshotConfig) + (isCancelled ? ' (partial)' : '');
      addAnalysisEntry({
        focus: entryFocus,
        customPrompt: snapshotConfig.customPrompt,
        content: isCancelled ? '' : streamingContent,
        pathwayContent: mergedEntryPathwayContent,
        parts: analysisMessageParts,
        label: analysisLabel,
      });

      // Persist to permanent analysis history (survives app restarts).
      // Only save if pobCode exists — account-imported builds can't be re-imported from history.
      if (currentBuild?.pobCode) {
        const storeState = useDesktopStore.getState();
        const histStore = useAnalysisHistoryStore.getState();
        const existingSnapId = histStore.activeSnapshotId;

        // Merge with any previously saved pathwayContent so resume doesn't lose
        // completed pathways from the first run.
        const existingSnap = existingSnapId
          ? histStore.snapshots.find(s => s.id === existingSnapId)
          : undefined;
        const mergedPathwayContent = {
          ...(existingSnap?.pathwayContent ?? {}),
          ...pathwayContent,
        };

        const snapshotData = {
          focus: entryFocus,
          customPrompt: snapshotConfig.customPrompt,
          label: analysisLabel,
          pathwayContent: mergedPathwayContent,
          isPartial: isCancelled,
          completedPathways: [...completedPathways],
          status: isCancelled ? 'partial' as const : 'complete' as const,
          parts: analysisMessageParts,
          pathwayHistories: storeState.pathwayHistories,
          vizData: storeState.vizData,
          pathwayCards: storeState.pathwayCards,
          generalAssessment: storeState.generalAssessment,
          buildRatings: storeState.buildRatings,
          gearSlotRatings: storeState.gearSlotRatings,
          seerContext: storeState.seerContext,
          topActions: storeState.topActions,
          pathwayPriorityOrder: storeState.pathwayPriorityOrder,
          // Token/credit data (complete session capture)
          tokenEntries: useTokenStore.getState().entries,
          tokenTotals: useTokenStore.getState().totals,
          creditsUsed: useTokenStore.getState().creditsUsedSession,
          // Additional session state
          suggestedQuestions: storeState.suggestedQuestions,
          treeSimulationResults: storeState.treeSimulationResults,
          treeDiffNodes: storeState.treeDiffNodes,
        };

        if (existingSnapId) {
          // Update the streaming snapshot created by pathway_complete
          histStore.upsertSnapshot(existingSnapId, snapshotData);
        } else {
          // No streaming snapshot — create a new one
          histStore.saveSnapshot({
            build: {
              characterName: currentBuild.characterName,
              class: currentBuild.class,
              ascendancy: currentBuild.ascendancy || currentBuild.class,
              level: currentBuild.level,
              pobCode: currentBuild.pobCode,
            },
            ...snapshotData,
          });
        }
      }
      if (!isCancelled && activeUIMode === 'analyze-results') {
        // Only auto-switch tabs when user is already viewing results.
        // If they navigated back to config, don't override their view — they'll
        // click "View Results" when ready (which has its own tab-selection logic).
        const tabPriority = ['qa', 'unified', 'gear', 'skills', 'tree'] as const;
        const firstPathway = tabPriority.find(p => entryFocus.includes(p));
        if (firstPathway) {
          setActivePathwayTab(firstPathway);
          if (firstPathway === 'unified') {
            setActivePathway('unified');
          } else if (firstPathway !== 'qa') {
            setActivePathway(firstPathway);
          } else {
            setActivePathway(null);
          }
        }
      }
      wasGeneratingRef.current = false;
      wasCancelledRef.current = false;
    }
  }, [isGeneratingInitialAnalysis, streamingContent, activeUIMode, setActiveUIMode, addAnalysisEntry, generateAnalysisLabel, setActivePathwayTab, setActivePathway, analysisMessageParts, addPathwayMessage, completedPathways]);

  // Redirect if no build; reset cancellation state on build change
  useEffect(() => {
    if (!currentBuild) {
      navigate('/');
    }
  }, [currentBuild, navigate]);

  // Compute ALL analyzed pathways from ALL history entries (union)
  // Hooks must be called unconditionally (before any early returns) per Rules of Hooks
  const allAnalyzedPathways = useMemo(() => {
    const pathwaySet = new Set<AnalysisFocus>();
    for (const entry of analysisHistory.entries) {
      for (const focus of entry.focus) {
        pathwaySet.add(focus);
      }
    }
    if (pathwayHistories.unified.length > 0) {
      pathwaySet.add('unified');
    }
    // Return in consistent order: Q&A first, then gear, skills, tree
    // Synthesis tab is always appended by PathwayTabs component itself
    const order: Array<'unified' | 'skills' | 'gear' | 'tree' | 'qa'> = ['qa', 'unified', 'gear', 'skills', 'tree'];
    return order.filter(p => pathwaySet.has(p));
  }, [analysisHistory.entries, pathwayHistories.unified.length]);

  // Find the entry that contains content for the active pathway tab
  const getEntryForPathway = useCallback((pathway: AnalysisFocus) => {
    // Synthesis content is handled via synthesisMessages prop, not analysis entries
    if ((pathway as string) === 'synthesis') return null;
    // Find the most recent entry that includes this pathway
    // Search in reverse order to get most recent
    for (let i = analysisHistory.entries.length - 1; i >= 0; i--) {
      const entry = analysisHistory.entries[i];
      if (entry.focus.includes(pathway)) {
        return entry;
      }
    }
    return null;
  }, [analysisHistory.entries]);

  // Loading state
  if (!currentBuild) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // Is the currently-viewed tab part of the active stream?
  // Used to distinguish "this tab is streaming" vs "viewing a completed history tab while another streams"
  const isActiveTabStreaming = streamingPathways.has(activePathwayTab);

  // Get the analysis content to display for the current tab
  // During streaming of THIS tab: use streamingContent (AnalyzeMode ignores it, shows tool steps)
  // Viewing a completed history tab (even while another tab streams): show saved content
  const activeAnalysisEntry = getActiveAnalysisEntry();
  const entryForActiveTab = getEntryForPathway(activePathwayTab);
  // For pathway tabs (gear/skills/tree), ONLY use pathway-specific content.
  // Never fall through to the global `content` which mixes all pathways together.
  // For 'qa' tab or single-pathway analyses, global content is acceptable as fallback.
  const isPathwayTab = ['gear', 'skills', 'tree', 'unified'].includes(activePathwayTab);
  const multiPathway = analysisConfig.focus.length > 1;
  const analysisContent = isActiveTabStreaming
    ? (streamingContentByPathway[activePathwayTab] || '')
    : (entryForActiveTab?.pathwayContent?.[activePathwayTab]
      || activeAnalysisEntry?.pathwayContent?.[activePathwayTab]
      // Fallback: pathway completed but analysis entry not yet created (other pathways still streaming)
      || streamingContentByPathway[activePathwayTab]
      // Only fall back to global content for single-pathway analyses or non-pathway tabs
      || (isPathwayTab && multiPathway ? '' : (entryForActiveTab?.content || activeAnalysisEntry?.content || ''))
      || '');

  const completedFocusesForUI = [
    ...completedPathways,
    ...(pathwayHistories.unified.length > 0 ? ['unified'] : []),
  ];

  return (
    <EntityTooltipProvider>
      <ChatPageLayout
        // Left sidebar: Compact stats (show loading until viz data arrives)
        statsPanel={vizData ? <CompactStatsSidebar stats={compactStats} onOpenConfigPanel={() => setIsConfigPanelOpen(true)} onOpenAttributePanel={() => setIsAttributePanelOpen(true)} bandit={banditChoice} onBanditChange={handleBanditChange} isBanditLoading={isBanditLoading || isLadderFetching} showBanditHint={compactStats.resistances != null && (compactStats.resistances.fire < 75 || compactStats.resistances.cold < 75 || compactStats.resistances.lightning < 75)} pantheonMajor={pantheonMajor} pantheonMinor={pantheonMinor} onPantheonChange={handlePantheonChange} isPantheonLoading={isPantheonLoading || isLadderFetching} hideBanditPantheon={isLadderFetching} /> : (
          vizStreamError ? (
            <div className="flex flex-col items-center justify-center h-32 mt-4 px-2 gap-2">
              <span className="text-xs text-red-400">{vizStreamError}</span>
            </div>
          ) : null
        )}
        // Main content: Mode-specific content (no top nav bar - Analysis-First Navigation)
        mainContent={
          <div className="flex flex-col h-full">
            {/* Pathway Tabs + Back button row - shows during streaming and results */}
            {(isGeneratingInitialAnalysis || activeUIMode === 'analyze-results') && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/50">
                {/* Back button inline with tabs - only when viewing results */}
                {activeUIMode === 'analyze-results' && (
                  <button
                    onClick={handleBackToConfig}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 transition-all flex-shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="font-display">Back</span>
                  </button>
                )}
              </div>
            )}

            {/* Mode Content */}
            <div className="flex-1 overflow-hidden">
              {/* Analysis Configuration (default landing) */}
              {activeUIMode === 'analyze-config' && (
                <AnalyzeMode
                  mode="config"
                  buildId={currentBuild.buildId}
                  config={analysisConfig}
                  onConfigChange={(updates) => setAnalysisConfig(updates)}
                  isAnalyzing={isGeneratingInitialAnalysis}
                  analysisContent=""
                  streamingContent={streamingContent}
                  onStartAnalysis={handleStartAnalysis}
                  // Welcome header props
                  buildName={currentBuild.class || 'Unknown Build'}
                  ascendancy={currentBuild.ascendancy || currentBuild.class || 'Unknown'}
                  level={currentBuild.level || 1}
                  mainSkill={vizData?.stats?.activeSkillName || undefined}
                  // View existing results props
                  hasExistingResults={analysisHistory.entries.length > 0}
                  onViewResults={handleViewResults}
                  // Streaming message parts
                  messageParts={analysisMessageParts}
                  // Loading gate - don't render config until viz data is ready
                  isVizLoading={isLoadingViz || !vizData}
                  // Auth & credit gating
                  authState={authAccount}
                  errorCode={errorCode}
                  // Completed pathways for graying out
                  completedPathways={completedPathways}
                  // Ladder data (runs in parallel with viz loading)
                  ladder={ladder}
                  // Bandit quest verification
                  bandit={banditChoice}
                  onBanditChange={handleBanditChange}
                  isBanditLoading={isBanditLoading || isLadderFetching}
                  // Pantheon verification
                  pantheonMajor={pantheonMajor}
                  pantheonMinor={pantheonMinor}
                  onPantheonChange={handlePantheonChange}
                  isPantheonLoading={isPantheonLoading || isLadderFetching}
                  // Streaming status
                  streamingStatus={streamingStatus}
                  // Queue pathways when analysis is running
                  onQueuePathways={(pws) => setPathwayQueue(prev => [...new Set([...prev, ...pws])])}
                />
              )}

              {/* Analysis Results with pathway tabs and bottom bar */}
              {activeUIMode === 'analyze-results' && (
                <AnalyzeMode
                  mode="results"
                  buildId={currentBuild.buildId}
                  config={analysisConfig}
                  onConfigChange={(updates) => setAnalysisConfig(updates)}
                  isAnalyzing={isActiveTabStreaming}
                  isAnyAnalysisRunning={isGeneratingInitialAnalysis}
                  analysisContent={analysisContent}
                  streamingContent={streamingContent}
                  onStartAnalysis={handleStartAnalysis}
                  activePathwayTab={activePathwayTab}
                  onPathwayTabChange={handlePathwayTabChange}
                  // Welcome header props (for back navigation context)
                  buildName={currentBuild.class || 'Unknown Build'}
                  ascendancy={currentBuild.ascendancy || currentBuild.class || 'Unknown'}
                  level={currentBuild.level || 1}
                  mainSkill={vizData?.stats?.activeSkillName || undefined}
                  // Inline chat props
                  onSendChatMessage={handleInlineChatMessage}
                  isChatLoading={isSending}
                  suggestedQuestions={suggestedQuestions}
                  // Message parts: live stream for active tab, stored parts for completed history tabs
                  // Synthesis tab has its own rendering via synthesisMessages — use empty parts
                  messageParts={(activePathwayTab as string) === 'synthesis'
                    ? []
                    : isActiveTabStreaming
                      ? analysisMessageParts.filter(p => !('pathway' in p) || !p.pathway || p.pathway === activePathwayTab)
                      : (isGeneratingInitialAnalysis && !entryForActiveTab
                          ? analysisMessageParts  // Still streaming other pathways, no entry yet — use live parts
                          : (entryForActiveTab?.parts ?? analysisMessageParts))
                  }
                  // Follow-up chat history - pathway-scoped conversation
                  chatMessages={activePathwayTab !== 'qa' && (activePathwayTab as string) !== 'synthesis'
                    ? pathwayHistories[activePathwayTab as PathwayType | 'unified'] ?? []
                    : []}
                  // Auth & credit gating
                  authState={authAccount}
                  errorCode={errorCode}
                  // Synthesis props
                  completedPathways={completedFocusesForUI}
                  // Ladder data
                  ladder={ladder}
                  // Bandit quest verification
                  bandit={banditChoice}
                  onBanditChange={handleBanditChange}
                  isBanditLoading={isBanditLoading || isLadderFetching}
                  // Pantheon verification
                  pantheonMajor={pantheonMajor}
                  pantheonMinor={pantheonMinor}
                  onPantheonChange={handlePantheonChange}
                  isPantheonLoading={isPantheonLoading || isLadderFetching}
                  // Streaming status
                  streamingStatus={streamingStatus}
                  // Live trade search progress (drives the inline card during follow-up)
                  liveTradeSearch={liveTradeSearch}
                  // Queue pathways when analysis is running
                  onQueuePathways={(pws) => setPathwayQueue(prev => [...new Set([...prev, ...pws])])}
                />
              )}

            </div>
          </div>
        }
        // Right sidebar: Context panel (Gear/Skills/Tree)
        contextPanel={
          <div className="flex flex-col h-full">
            {/* Tab Bar */}
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab Content with forge-style inset */}
            <div className="flex-1 overflow-y-auto scrollbar-fantasy forge-inset relative">
              {/* Content background gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/50 pointer-events-none" />

              {isLoadingViz ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 text-amber-400/50 animate-spin" />
                </div>
              ) : !vizData ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                  <div className="w-12 h-12 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-slate-600" />
                  </div>
                  <span className="text-sm">No build data loaded</span>
                </div>
              ) : (
                <div className="relative p-4 flex flex-col gap-4">
                  <div style={{ display: activeTab === 'skills' ? undefined : 'none' }}>
                    {vizData.skills && (
                      <SkillsVizTab skills={vizData.skills} items={vizData.items} />
                    )}
                  </div>
                  <div style={{ display: activeTab === 'tree' ? undefined : 'none' }}>
                    {vizData.tree && (
                      <TreeVizTab tree={vizData.tree} items={vizData.items} />
                    )}
                  </div>
                  <div style={{ display: activeTab === 'gear' ? undefined : 'none' }}>
                    {vizData.items && (
                      <GearVizTab
                        items={vizData.items}
                        skills={vizData.skills}
                        clusterNodes={vizData.tree?.clusterNodes}
                        timelessBySocket={vizData.tree?.timelessBySocket}
                        expandedSlots={expandedSlots}
                        onToggleSlot={(slot) => {
                          setExpandedSlots((prev) =>
                            prev.includes(slot)
                              ? prev.filter((s) => s !== slot)
                              : [...prev, slot]
                          );
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        // Header props
        buildName={currentBuild.class || 'Build'}
        ascendancy={currentBuild.ascendancy}
        level={currentBuild.level}
        mainSkill={vizData?.stats?.activeSkillName || undefined}
        // Back button to return to landing page (disabled during ladder fetch)
        onBack={isLadderFetching ? undefined : () => navigate('/')}
        // Header actions - forge-styled badges and buttons
        headerActions={
          <div className="flex items-center gap-2">
            {/* Functional badges: Ladder + Credits */}
            <LadderBadge
              buildCount={ladderStats?.buildCount}
              hasData={!!ladderStats}
              onClick={() => setIsLadderModalOpen(true)}
            />
            <CreditBadge credits={creditBalance} onClick={() => setIsTokenDrawerOpen(true)} />

            {/* Utility capsule: Version | Discord — unified container */}
            <div className={cn(
              'flex items-center h-8',
              'rounded-lg',
              'bg-gradient-to-b from-slate-700/30 to-slate-800/50',
              'border border-slate-600/20',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.2)]',
            )}>
              {import.meta.env.DEV && (
                <>
                  <ContextInspectorButton onClick={() => setIsContextInspectorOpen(true)} />
                  {/* Hairline divider */}
                  <div className="w-px h-3.5 bg-gradient-to-b from-transparent via-slate-500/25 to-transparent" />
                </>
              )}
              <VersionBadge />
              {/* Session ID badge — shown after analysis starts, click to copy for bug reports */}
              {analysisSessionId && (
                <>
                  <div className="w-px h-3.5 bg-gradient-to-b from-transparent via-slate-500/25 to-transparent" />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(analysisSessionId);
                      toast.success('Session ID copied to clipboard');
                    }}
                    className="text-[10px] text-slate-500 hover:text-amber-400 font-mono transition-colors cursor-pointer px-1"
                    title={`Session: ${analysisSessionId}\nClick to copy — include in bug reports on Discord`}
                  >
                    {analysisSessionId.slice(0, 8)}
                  </button>
                </>
              )}
              {/* Hairline divider */}
              <div className="w-px h-3.5 bg-gradient-to-b from-transparent via-slate-500/25 to-transparent" />
              <DiscordButton />
            </div>
          </div>
        }
      />

      {/* Side Panels */}
      <ConfigDetailPanel
        isOpen={isConfigPanelOpen}
        onClose={() => setIsConfigPanelOpen(false)}
        configs={compactStats.configAssumptions}
        opportunities={compactStats.configOpportunities}
      />
      <AttributeRequirementsPanel
        isOpen={isAttributePanelOpen}
        onClose={() => setIsAttributePanelOpen(false)}
        data={attributeRequirements}
      />
      <TokenUsageDrawer
        isOpen={isTokenDrawerOpen}
        onClose={() => setIsTokenDrawerOpen(false)}
      />
      {import.meta.env.DEV && (
        <ContextInspectorModal
          isOpen={isContextInspectorOpen}
          onClose={() => setIsContextInspectorOpen(false)}
        />
      )}
      <LadderStatsDrawer
        isOpen={isLadderDrawerOpen}
        onClose={() => setIsLadderDrawerOpen(false)}
      />
      <MetaIntelDrawer
        isOpen={isMetaIntelOpen}
        onClose={() => setIsMetaIntelOpen(false)}
      />

      {/* Full Ladder Benchmarks Modal */}
      {currentBuild && (
        <LadderBenchmarksModal
          buildId={currentBuild.buildId}
          isOpen={isLadderModalOpen}
          onClose={() => setIsLadderModalOpen(false)}
          ladderConfigGaps={vizData?.configRecommendation?.ladderConfigGaps}
          skill={vizData?.stats?.activeSkillName || undefined}
          ascendancy={currentBuild.ascendancy}
          userLevel={currentBuild.level}
          userStats={{
            dps: vizData?.stats?.totalBuildDps ?? vizData?.stats?.dps,
            ehp: vizData?.stats?.ehp,
            life: vizData?.stats?.life,
            energyShield: vizData?.stats?.energyShield,
            armour: vizData?.stats?.armour,
            evasion: vizData?.stats?.evasion,
            blockChance: vizData?.stats?.blockChance,
            spellBlockChance: vizData?.stats?.spellBlockChance,
          }}
        />
      )}

      {/* Stash Overview Modal */}
      <StashOverviewModal
        isOpen={isStashModalOpen}
        onClose={() => setIsStashModalOpen(false)}
      />

      {/* Single-pathway cost confirm dialog (triggered by clicking unlocked tab) */}
      <PathwayCostConfirmDialog
        isOpen={pendingPathwayConfirm !== null}
        onConfirm={handlePathwayConfirmRun}
        onCancel={() => setPendingPathwayConfirm(null)}
        pathways={pendingPathwayConfirm ? [pendingPathwayConfirm] : []}
        currentBalance={creditBalance}
      />
    </EntityTooltipProvider>
  );
}

export default ChatPage;
