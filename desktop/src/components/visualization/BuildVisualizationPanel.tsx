/**
 * BuildVisualizationPanel Component
 *
 * Main wrapper component for the left panel build visualization.
 * Renders appropriate content based on activeTab (controlled externally via UnifiedTabBar).
 * The tab bar is removed - navigation is now handled by the parent EnhancedPathwayLayout.
 */

import { motion } from 'framer-motion';
import { GearVizTab } from './GearVizTab';
import { SkillsVizTab } from './SkillsVizTab';
import { TreeVizTab } from './TreeVizTab';
import { OverviewStatsPanel } from './OverviewStatsPanel';
import { ChatVizPanel } from './ChatVizPanel';
import { BuildLoadingSteps } from './BuildLoadingSteps';
import { useDesktopStore } from '../../store';
import type { BuildVisualizationResponse, UnifiedTab } from '../../store';
import { cn } from '../../lib/utils';
import type { SeerContextData, ToolExecutionInfo } from '../../../../shared/types/Chat';
import type { LiveTradeSearchState } from '../../hooks/useDesktopChat';

interface BuildVisualizationPanelProps {
  vizData: BuildVisualizationResponse | null;
  activeTab: UnifiedTab;
  expandedSlots: string[];
  expandedSkillSlots: string[];
  focusedSkillGroupIndex?: number | null;
  hoveredSkillGroupIndex?: number | null;
  onToggleSlot: (slot: string) => void;
  onToggleSkillSlot: (slot: string) => void;
  seerContext?: SeerContextData | null;
  // Chat tab props
  chatActiveTools?: Map<string, ToolExecutionInfo>;
  chatLiveTradeSearch?: LiveTradeSearchState | null;
  chatSuggestedQuestions?: string[];
  chatLeagueQuestions?: string[];
  onSendChatMessage?: (content: string) => Promise<void>;
  isChatSending?: boolean;
}

export function BuildVisualizationPanel({
  vizData,
  activeTab,
  expandedSlots,
  expandedSkillSlots,
  focusedSkillGroupIndex,
  hoveredSkillGroupIndex,
  onToggleSlot,
  onToggleSkillSlot,
  seerContext,
  chatActiveTools,
  chatLiveTradeSearch,
  chatSuggestedQuestions,
  chatLeagueQuestions,
  onSendChatMessage,
  isChatSending,
}: BuildVisualizationPanelProps) {
  const vizLoadingSteps = useDesktopStore((s) => s.vizLoadingSteps);
  const vizStreamError = useDesktopStore((s) => s.vizStreamError);

  // Loading state - skip for chat tab which doesn't require vizData
  if (!vizData && activeTab !== 'chat') {
    return (
      <div
        className={cn(
          'flex flex-col h-full',
          'bg-poe-atmosphere rounded-xl',
          'border border-slate-700/50'
        )}
      >
        <BuildLoadingSteps steps={vizLoadingSteps} variant="full" error={vizStreamError} />
      </div>
    );
  }

  // Get main skill name from socket group if stats.activeSkillName is empty
  const mainSocketGroupIndex = vizData
    ? (vizData.skills?.mainSocketGroup ?? 1) - 1
    : 0; // 1-based to 0-based
  const mainSocketGroup = vizData?.skills?.groups?.[mainSocketGroupIndex];
  const activeGems = mainSocketGroup?.gemList?.filter(g => !g.isSupport) || [];
  const derivedSkillName = activeGems[0]?.nameSpec || mainSocketGroup?.skills?.[0];

  // Convert vizData.stats to OverviewStats format
  const overviewStats = vizData?.stats ? {
    dps: vizData.stats.dps,
    critChance: vizData.stats.critChance,
    critMultiplier: vizData.stats.critMultiplier,
    speed: vizData.stats.speed,
    // Offensive - skill details
    activeSkillName: vizData.stats.activeSkillName || derivedSkillName || 'Unknown Skill',
    hitDps: vizData.stats.hitDps,
    totalDotDps: vizData.stats.totalDotDps,
    // Ailment DPS breakdown
    bleedDps: vizData.stats.bleedDps ?? 0,
    igniteDps: vizData.stats.igniteDps ?? 0,
    poisonDps: vizData.stats.poisonDps ?? 0,
    // Defensive
    life: vizData.stats.life,
    energyShield: vizData.stats.energyShield,
    armour: vizData.stats.armour,
    evasion: vizData.stats.evasion,
    ehp: vizData.stats.ehp,
    // Per-element EHP
    ehpFire: vizData.stats.ehpFire,
    ehpCold: vizData.stats.ehpCold,
    ehpLightning: vizData.stats.ehpLightning,
    ehpChaos: vizData.stats.ehpChaos,
    // Max Hit Taken
    maxHitPhysical: vizData.stats.maxHitPhysical,
    maxHitFire: vizData.stats.maxHitFire,
    maxHitCold: vizData.stats.maxHitCold,
    maxHitLightning: vizData.stats.maxHitLightning,
    maxHitChaos: vizData.stats.maxHitChaos,
    // Resistances
    fireResist: vizData.stats.fireResist,
    coldResist: vizData.stats.coldResist,
    lightningResist: vizData.stats.lightningResist,
    chaosResist: vizData.stats.chaosResist,
    fireResistOverCap: vizData.stats.fireResistOverCap ?? 0,
    coldResistOverCap: vizData.stats.coldResistOverCap ?? 0,
    lightningResistOverCap: vizData.stats.lightningResistOverCap ?? 0,
    chaosResistOverCap: vizData.stats.chaosResistOverCap ?? 0,
    // Block
    blockChance: vizData.stats.blockChance ?? 0,
    spellBlockChance: vizData.stats.spellBlockChance ?? 0,
  } : undefined;

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        'bg-slate-900/20 rounded-xl',
        'border border-slate-700/50'
      )}
    >
      {/* Tab content - Tab bar removed, controlled by parent UnifiedTabBar */}
      <div className="flex-1 overflow-y-auto scrollbar-fantasy p-3">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="min-h-full"
        >
          {activeTab === 'overview' && (
            <OverviewStatsPanel stats={overviewStats} />
          )}
          {activeTab === 'gear' && vizData && (
            <GearVizTab
              items={vizData.items}
              skills={vizData.skills}
              clusterNodes={vizData.tree?.clusterNodes}
              timelessBySocket={vizData.tree?.timelessBySocket}
              expandedSlots={expandedSlots}
              onToggleSlot={onToggleSlot}
            />
          )}
          {activeTab === 'skills' && vizData && (
            <SkillsVizTab
              skills={vizData.skills}
              items={vizData.items}
              focusedSkillGroupIndex={focusedSkillGroupIndex}
              hoveredSkillGroupIndex={hoveredSkillGroupIndex}
            />
          )}
          {activeTab === 'tree' && vizData && <TreeVizTab tree={vizData.tree} items={vizData.items} />}
          {activeTab === 'chat' && (
            <ChatVizPanel
              activeTools={chatActiveTools}
              liveTradeSearch={chatLiveTradeSearch}
              suggestedQuestions={chatSuggestedQuestions}
              leagueQuestions={chatLeagueQuestions}
              onSendQuestion={onSendChatMessage}
              isSending={isChatSending}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default BuildVisualizationPanel;
