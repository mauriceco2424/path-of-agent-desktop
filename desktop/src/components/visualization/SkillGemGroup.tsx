/**
 * SkillGemGroup Component - Socket Chain Display
 *
 * Displays a gem group with:
 * - Round socket circles with metallic styling
 * - Gem icons from PoE Wiki inside sockets
 * - Continuous vertical link line connecting sockets
 */

import { forwardRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Star, Zap, Sparkles, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GemTooltip } from './GemTooltip';

export interface GemData {
  name: string;
  level?: number;
  quality?: number;
  gemColor?: 'red' | 'green' | 'blue' | 'white';
  isSupport: boolean;
  isAwakened?: boolean;
  isVaal?: boolean;
  qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
  skillType?: string;
  triggeredBy?: string;
  iconUrl?: string;
  // Tooltip data from RePoE
  description?: string | null;
  statText?: string[];
  manaCost?: number | null;
  manaReservation?: number | null;
  lifeReservation?: number | null;
  requirements?: {
    level?: number | null;
    str?: number | null;
    dex?: number | null;
    int?: number | null;
  };
  gemTags?: string[];
  costMultiplier?: number | null;
  damageEffectiveness?: number | null;
}

interface SkillGemGroupProps {
  gems: GemData[];
  sockets?: Array<{ color: string; group: number }>;
  /** Source descriptor — present for item/node-granted skill groups */
  source?: string;
  isMainGroup: boolean;
  mainActiveIndex: number;
  isHighlighted?: boolean;
  groupIndex: number;
}

/** Socket color styles for the metallic rim */
const SOCKET_COLORS = {
  R: {
    rim: 'from-red-300 via-red-500 to-red-800',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    inner: 'bg-red-950/80',
    text: 'text-red-300',
  },
  G: {
    rim: 'from-emerald-300 via-emerald-500 to-emerald-800',
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    inner: 'bg-emerald-950/80',
    text: 'text-emerald-300',
  },
  B: {
    rim: 'from-blue-300 via-blue-500 to-blue-800',
    glow: 'shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    inner: 'bg-blue-950/80',
    text: 'text-blue-300',
  },
  W: {
    rim: 'from-slate-200 via-slate-400 to-slate-600',
    glow: 'shadow-[0_0_6px_rgba(226,232,240,0.4)]',
    inner: 'bg-slate-900/80',
    text: 'text-slate-200',
  },
};

/** Quality type styling */
const QUALITY_STYLES = {
  anomalous: { text: 'text-cyan-400', label: 'A' },
  divergent: { text: 'text-orange-400', label: 'D' },
  phantasmal: { text: 'text-fuchsia-400', label: 'P' },
};

function gemColorToCode(color?: string): 'R' | 'G' | 'B' | 'W' {
  switch (color) {
    case 'red': return 'R';
    case 'green': return 'G';
    case 'blue': return 'B';
    default: return 'W';
  }
}

/** Complete gem row with socket + info + controlled tooltip */
function GemRow({
  gem,
  socketColor,
  isMain,
  isActive,
  isFirst,
  showLinkLine,
  isMainGroup,
}: {
  gem: GemData;
  socketColor: string;
  isMain: boolean;
  isActive: boolean;
  isFirst: boolean;
  showLinkLine: boolean;
  isMainGroup: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const colorStyle = SOCKET_COLORS[socketColor as keyof typeof SOCKET_COLORS] || SOCKET_COLORS.W;

  // Socket sizes
  const outerSize = isActive ? 'w-7 h-7' : 'w-6 h-6';
  const innerSize = isActive ? 'w-5 h-5' : 'w-4 h-4';
  const iconSize = isActive ? 'w-5 h-5' : 'w-4 h-4';

  const rowContent = (
    <div
      className={cn(
        'flex items-center gap-2 cursor-pointer px-1 -mx-1',
        isActive ? 'h-8' : 'h-7',
        !isFirst && 'mt-1',
        'hover:bg-slate-800/40 rounded-sm transition-colors'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Socket with link line */}
      <div className="relative flex-shrink-0">
        {/* Link line segment */}
        {showLinkLine && !isFirst && (
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 -top-2 h-2 w-0.5 rounded-full',
              isMainGroup
                ? 'bg-amber-500/40'
                : 'bg-slate-600/40'
            )}
          />
        )}
        {/* Socket */}
        <div
          className={cn(
            'relative flex-shrink-0 rounded-full p-[2px]',
            'bg-gradient-to-br',
            colorStyle.rim,
            colorStyle.glow,
            isMain && 'ring-2 ring-amber-400/70 ring-offset-1 ring-offset-slate-900'
          )}
        >
          <div
            className={cn(
              'rounded-full flex items-center justify-center',
              outerSize,
              colorStyle.inner,
              'shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),inset_0_-1px_2px_rgba(255,255,255,0.1)]'
            )}
          >
            {gem.iconUrl && !imgError ? (
              <img
                src={gem.iconUrl}
                alt={gem.name}
                className={cn(iconSize, 'object-contain rounded-sm')}
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                className={cn(
                  innerSize,
                  'rounded-full bg-gradient-to-br',
                  colorStyle.rim,
                  'shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),inset_0_-1px_2px_rgba(0,0,0,0.4)]'
                )}
              />
            )}
          </div>
        </div>
      </div>

      {/* Main skill indicator */}
      {isMain && (
        <Star className="w-3 h-3 text-amber-400 fill-amber-400/50 flex-shrink-0" />
      )}

      {/* Gem name - use gem's attribute color (red/green/blue/white) */}
      <span
        className={cn(
          'flex-1 truncate',
          isActive ? 'text-sm' : 'text-xs',
          isMain
            ? 'text-amber-200 font-medium'
            : SOCKET_COLORS[gemColorToCode(gem.gemColor)]?.text || colorStyle.text
        )}
      >
        {gem.isVaal && !gem.isSupport && (
          <Flame className="w-3 h-3 inline -mt-0.5 mr-0.5 text-red-400" />
        )}
        {gem.isAwakened && (
          <span className="text-purple-400 mr-0.5">
            {gem.isSupport ? 'Awk. ' : <Sparkles className="w-3 h-3 inline -mt-0.5 mr-0.5" />}
          </span>
        )}
        {gem.name
          .replace(/^(Vaal |Awakened )/, '')
          .replace(/ Support$/, '')}
      </span>

      {/* Level/Quality */}
      <span
        className={cn(
          'tabular-nums flex-shrink-0',
          isActive ? 'text-[0.625rem]' : 'text-[0.5625rem]',
          isMain ? 'text-amber-300/80' : 'text-slate-500'
        )}
      >
        {gem.level ?? 20}/{gem.quality ?? 0}
      </span>

      {/* Trigger badge */}
      {gem.triggeredBy && (
        <span className="flex items-center gap-0.5 text-[0.5625rem] text-cyan-400 flex-shrink-0">
          <Zap className="w-2.5 h-2.5" />
          trigger
        </span>
      )}

      {/* Quality type */}
      {gem.qualityType && gem.qualityType !== 'standard' && (
        <span
          className={cn(
            'text-[0.5rem] font-semibold flex-shrink-0',
            QUALITY_STYLES[gem.qualityType]?.text
          )}
        >
          {QUALITY_STYLES[gem.qualityType]?.label}
        </span>
      )}
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root open={isHovered}>
        <Tooltip.Trigger asChild>{rowContent}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="left" sideOffset={8} className="z-50">
            <GemTooltip
              name={gem.name}
              gemColor={gem.gemColor}
              isSupport={gem.isSupport}
              isVaal={gem.isVaal}
              isAwakened={gem.isAwakened}
              level={gem.level}
              quality={gem.quality}
              qualityType={gem.qualityType}
              description={gem.description}
              statText={gem.statText}
              manaCost={gem.manaCost}
              manaReservation={gem.manaReservation}
              lifeReservation={gem.lifeReservation}
              requirements={gem.requirements}
              gemTags={gem.gemTags}
              costMultiplier={gem.costMultiplier}
              damageEffectiveness={gem.damageEffectiveness}
            />
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** Amber glow for skills pathway - unified accent color */
const AMBER_GLOW = 'rgba(251, 191, 36, 0.4)';

export const SkillGemGroup = forwardRef<HTMLDivElement, SkillGemGroupProps>(
  function SkillGemGroup(
    { gems, sockets, source, isMainGroup, mainActiveIndex, isHighlighted },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false);

    // Socket colors are derived from either:
    // 1. The sockets prop (from gear item) - used for visual color of socket circles
    // 2. Fallback to gem colors if sockets not provided
    // NOTE: The sockets prop may have MORE entries than gems (e.g., 6-socket item with only 3 gems)
    // We only use it for colors, not for determining link count.
    const socketColors = sockets?.map(s => s.color) || gems.map(g => gemColorToCode(g.gemColor));

    // Link count = number of gems actually in this skill group
    // This is the correct "xL" value to display because it represents how many gems
    // are linked together in this group. A single gem shows no link badge (linkCount <= 1).
    // Note: This may differ from the physical socket count on the gear item.
    const linkCount = gems.length;

    return (
      <div
        ref={ref}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'group relative rounded-lg overflow-hidden',
          'card-forge',
          'transition-all duration-200'
        )}
        style={{
          ...(isHovered ? {
            boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px ${AMBER_GLOW}`,
            borderColor: 'rgba(251, 191, 36, 0.4)',
          } : {}),
          ...(isHighlighted ? {
            boxShadow: `0 4px 24px rgba(0, 0, 0, 0.5), 0 0 25px rgba(251, 191, 36, 0.4)`,
            borderColor: 'rgba(251, 191, 36, 0.5)',
          } : {}),
        }}
      >
        {/* Subtle top glow on hover */}
        <div
          className={cn(
            'absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 pointer-events-none',
            (isHovered || isHighlighted) && 'opacity-100'
          )}
          style={{
            background: isHighlighted
              ? 'radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.3) 0%, transparent 70%)'
              : `radial-gradient(circle at 50% 0%, ${AMBER_GLOW} 0%, transparent 70%)`,
          }}
        />

        <div className="relative z-[1] p-2.5">
          {/* Gem rows - each row has socket + info in a single tooltipable element */}
          <div className="flex flex-col">
            {gems.map((gem, idx) => {
              const socketColor = socketColors[idx] || 'W';
              const isMain = isMainGroup && !gem.isSupport && idx === mainActiveIndex;
              const isActive = !gem.isSupport;

              return (
                <GemRow
                  key={`gem-${gem.name}-${idx}`}
                  gem={gem}
                  socketColor={socketColor}
                  isMain={isMain}
                  isActive={isActive}
                  isFirst={idx === 0}
                  showLinkLine={linkCount > 1}
                  isMainGroup={isMainGroup}
                />
              );
            })}
          </div>

          {/* Footer badges: link count + granted indicator */}
          {(linkCount > 1 || source) && (
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-700/30">
              {source ? (
                <span className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-purple-400/80">
                  Granted
                </span>
              ) : <span />}
              {linkCount > 1 && (
                <span
                  className={cn(
                    'text-[0.625rem] font-bold tabular-nums px-2 py-0.5 rounded',
                    isMainGroup
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                      : 'bg-amber-500/10 border border-amber-500/25 text-amber-400/80'
                  )}
                >
                  {linkCount}L
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default SkillGemGroup;
