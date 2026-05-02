/**
 * MetaBuildOverviewPanel Component
 *
 * Compact meta build summary for the visualization (left) panel.
 * Shows key meta info: sample size, main skill, and quick stats.
 */

import { Trophy, Users, Target, BarChart3 } from 'lucide-react';
import type { SeerContextData } from '../../../../shared/types/Chat';

interface MetaBuildOverviewPanelProps {
  seerContext: SeerContextData | null;
}

export function MetaBuildOverviewPanel({ seerContext }: MetaBuildOverviewPanelProps) {
  const metaBuilds = seerContext?.metaBuilds;
  const kbInfo = seerContext?.kbModuleInfo;
  const metaSnapshot = seerContext?.metaSnapshot;
  const metaAvailable = metaBuilds?.status === 'loaded';

  if (!metaAvailable) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Meta build data is not available yet.
      </div>
    );
  }

  const totalFetched = metaBuilds?.totalFetched ?? kbInfo?.sampleSize ?? 0;
  const levelRange = metaBuilds?.levelRange || 'Unknown';
  const userMainSkill = metaBuilds?.userMainSkill || 'Unknown';
  const topSkills = metaSnapshot?.topSkills ?? [];
  const hasSkillSpecificData = Boolean(
    metaSnapshot?.topUniques?.length ||
    metaSnapshot?.topMods?.length
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-slate-100">Meta Snapshot</h3>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Sample Size */}
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900/20 via-black/15 to-slate-950/25 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users className="w-3 h-3 text-amber-400" />
            Sample Size
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {totalFetched}
          </div>
          <div className="text-xs text-slate-500">Level {levelRange}</div>
        </div>

        {/* Main Skill */}
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900/20 via-black/15 to-slate-950/25 p-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Target className="w-3 h-3 text-emerald-400" />
            Your Skill
          </div>
          <div className="mt-2 text-lg font-semibold text-emerald-300 truncate">
            {userMainSkill}
          </div>
          <div className="text-xs text-slate-500">
            {hasSkillSpecificData ? 'Skill data available' : 'Ascendancy data'}
          </div>
        </div>
      </div>

      {/* Data Coverage */}
      <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900/20 via-black/15 to-slate-950/25 p-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
          <BarChart3 className="w-3 h-3 text-cyan-400" />
          Data Coverage
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Top Skills</span>
            <span className={topSkills.length > 0 ? 'text-emerald-400' : 'text-slate-500'}>
              {topSkills.length > 0 ? `${topSkills.length} tracked` : 'None'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Stat Benchmarks</span>
            <span className={metaSnapshot?.statBenchmarks?.length ? 'text-emerald-400' : 'text-slate-500'}>
              {metaSnapshot?.statBenchmarks?.length ? 'Available' : 'None'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Skill-Specific</span>
            <span className={hasSkillSpecificData ? 'text-cyan-400' : 'text-slate-500'}>
              {hasSkillSpecificData ? 'Available' : 'Not found'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MetaBuildOverviewPanel;
