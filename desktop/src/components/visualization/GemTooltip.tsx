/**
 * GemTooltip Component
 *
 * Displays PoE-style gem tooltip with description, stats, requirements,
 * and tags. Used as hover content for skill gems in the Skills panel.
 * Stat text is color-formatted like Path of Building:
 * - Numeric values in cyan
 * - Descriptive text in slate gray
 */

import { cn } from '../../lib/utils';

/**
 * Token types for parsed stat text
 */
interface StatToken {
  text: string;
  type: 'value' | 'label';
}

/**
 * Parse a stat text string into tokens, separating numeric values from labels.
 * Handles: "9 to 14", "50%", "0.9 metres", ranges, and multiple values per line.
 */
function parseStatText(stat: string): StatToken[] {
  // Regex to match numeric values: integers, decimals, ranges ("9 to 14"), percentages
  // Also handles negative numbers and values with +/- prefixes
  const valuePattern = /([+-]?\d+(?:\.\d+)?(?:\s*to\s*[+-]?\d+(?:\.\d+)?)?%?)/g;

  const tokens: StatToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = valuePattern.exec(stat)) !== null) {
    // Add label text before this match
    if (match.index > lastIndex) {
      const labelText = stat.slice(lastIndex, match.index);
      if (labelText) {
        tokens.push({ text: labelText, type: 'label' });
      }
    }

    // Add the numeric value
    tokens.push({ text: match[0], type: 'value' });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining label text after last match
  if (lastIndex < stat.length) {
    tokens.push({ text: stat.slice(lastIndex), type: 'label' });
  }

  // If no matches found, return whole string as label
  if (tokens.length === 0) {
    tokens.push({ text: stat, type: 'label' });
  }

  return tokens;
}

/**
 * Renders a stat line with PoB-style coloring:
 * - Numeric values in cyan
 * - Labels/descriptions in slate gray
 */
function ColoredStatLine({ stat }: { stat: string }) {
  const tokens = parseStatText(stat);

  return (
    <div className="text-xs leading-relaxed">
      {tokens.map((token, i) => (
        <span
          key={i}
          className={token.type === 'value' ? 'text-cyan-400' : 'text-slate-300'}
        >
          {token.text}
        </span>
      ))}
    </div>
  );
}

interface GemTooltipProps {
  name: string;
  gemColor?: 'red' | 'green' | 'blue' | 'white';
  isSupport: boolean;
  isVaal?: boolean;
  isAwakened?: boolean;
  level?: number;
  quality?: number;
  qualityType?: 'standard' | 'anomalous' | 'divergent' | 'phantasmal';
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

/** Gem header colors based on attribute (matching in-game style) */
const gemHeaderColors = {
  red: 'text-red-300',
  green: 'text-emerald-300',
  blue: 'text-blue-300',
  white: 'text-slate-200',
};

/** Quality type indicator colors */
const qualityTypeColors = {
  standard: null,
  anomalous: 'text-cyan-400',
  divergent: 'text-orange-400',
  phantasmal: 'text-fuchsia-400',
};

export function GemTooltip({
  name,
  gemColor = 'blue',
  isSupport,
  isVaal,
  isAwakened,
  level,
  quality,
  qualityType,
  description,
  statText,
  manaCost,
  manaReservation,
  lifeReservation,
  requirements,
  gemTags,
  costMultiplier,
  damageEffectiveness,
}: GemTooltipProps) {
  const headerColor = gemHeaderColors[gemColor] || gemHeaderColors.blue;
  const hasDescription = description && description.trim();
  const hasStats = statText && statText.length > 0;
  const hasCost = manaCost || manaReservation || lifeReservation;
  const hasRequirements = requirements && (
    requirements.level || requirements.str || requirements.dex || requirements.int
  );
  const hasTags = gemTags && gemTags.length > 0;
  const hasMultipliers = costMultiplier || damageEffectiveness;

  // Build requirement string
  const reqParts: string[] = [];
  if (requirements?.level) reqParts.push(`Level ${requirements.level}`);
  if (requirements?.str) reqParts.push(`${requirements.str} Str`);
  if (requirements?.dex) reqParts.push(`${requirements.dex} Dex`);
  if (requirements?.int) reqParts.push(`${requirements.int} Int`);
  const requirementString = reqParts.length > 0 ? `Requires ${reqParts.join(', ')}` : null;

  return (
    <div className="min-w-[280px] max-w-[360px] p-3 rounded-lg card-forge card-forge-opaque shadow-xl shadow-black/50">
      {/* Header - gem name with color */}
      <div className="flex items-center gap-2">
        <span className={cn('text-sm font-semibold', headerColor)}>
          {isVaal && <span className="text-red-400">Vaal </span>}
          {isAwakened && <span className="text-purple-400">Awakened </span>}
          {name.replace(/^(Vaal |Awakened )/, '')}
        </span>
        {isSupport && (
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400">
            Support
          </span>
        )}
      </div>

      {/* Level and Quality */}
      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
        {level !== undefined && <span>Level: <span className="text-slate-200">{level}</span></span>}
        {quality !== undefined && quality > 0 && (
          <span>
            Quality: <span className="text-slate-200">{quality}%</span>
            {qualityType && qualityType !== 'standard' && (
              <span className={cn('ml-1', qualityTypeColors[qualityType])}>
                ({qualityType})
              </span>
            )}
          </span>
        )}
      </div>

      {/* Tags - PoE-style gem classification pills */}
      {hasTags && (
        <div className="flex flex-wrap gap-1 mt-2">
          {gemTags!.map((tag, i) => (
            <span
              key={i}
              className={cn(
                'text-[0.625rem] px-1.5 py-0.5 rounded-sm',
                'bg-gradient-to-b from-slate-700/60 to-slate-800/80',
                'border border-slate-600/40',
                'text-slate-300',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      {(hasDescription || hasStats || hasCost) && (
        <div className="border-t border-slate-700/60 my-2" />
      )}

      {/* Description - PoB-style tan/amber color */}
      {hasDescription && (
        <div className="text-xs text-amber-600/90 leading-relaxed">
          {description}
        </div>
      )}

      {/* Stats - PoB-style coloring with cyan values */}
      {hasStats && (
        <div className={cn('space-y-0.5', hasDescription && 'mt-2')}>
          {statText!.map((stat, i) => (
            <ColoredStatLine key={i} stat={stat} />
          ))}
        </div>
      )}

      {/* Support gem multipliers */}
      {hasMultipliers && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-slate-400">
          {costMultiplier && (
            <span>
              Cost Multiplier: <span className="text-amber-300">{costMultiplier}%</span>
            </span>
          )}
          {damageEffectiveness && (
            <span>
              Damage Effectiveness: <span className="text-amber-300">{damageEffectiveness}%</span>
            </span>
          )}
        </div>
      )}

      {/* Cost info */}
      {hasCost && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-slate-400">
          {manaCost && (
            <span>
              Mana Cost: <span className="text-blue-300">{manaCost}</span>
            </span>
          )}
          {manaReservation && (
            <span>
              Mana Reservation: <span className="text-blue-300">{manaReservation}%</span>
            </span>
          )}
          {lifeReservation && (
            <span>
              Life Reservation: <span className="text-red-300">{lifeReservation}%</span>
            </span>
          )}
        </div>
      )}

      {/* Requirements */}
      {requirementString && (
        <div className="text-xs text-slate-500 mt-2">
          {requirementString}
        </div>
      )}
    </div>
  );
}

export default GemTooltip;
