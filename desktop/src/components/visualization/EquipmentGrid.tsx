/**
 * EquipmentGrid Component
 *
 * Mannequin-style equipment grid with color-coded slot health.
 * Displays gear slots in a humanoid layout with visual indicators
 * for slot quality ratings (GOOD, AVERAGE, POOR, CRITICAL).
 */

import { motion } from 'framer-motion';
import {
  Crown,
  Shirt,
  Sword,
  Shield,
  Hand,
  Footprints,
  CircleDashed,
  Gem,
  CircleDot,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GearSlotRating, GearQualityRating } from '@shared/types';
import { normalizeSlotForMatching } from '@shared/utils/slot-colors';

export interface EquipmentGridProps {
  /** Array of gear slot ratings from LLM assessment */
  gearRatings: GearSlotRating[];
  /** True if build uses a two-handed weapon (off-hand slot shown as N/A) */
  isTwoHanded?: boolean;
  /** Optional click handler for slot navigation */
  onSlotClick?: (slot: string) => void;
}

/**
 * Rating color styles for visual indicators.
 */
const RATING_STYLES: Record<
  GearQualityRating,
  {
    bg: string;
    border: string;
    glow: string;
    text: string;
  }
> = {
  GOOD: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/60',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]',
    text: 'text-green-400',
  },
  AVERAGE: {
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/60',
    glow: 'shadow-[0_0_10px_rgba(234,179,8,0.3)]',
    text: 'text-yellow-400',
  },
  POOR: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/60',
    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.4)]',
    text: 'text-orange-400',
  },
  CRITICAL: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/60',
    glow: 'shadow-[0_0_16px_rgba(239,68,68,0.5)]',
    text: 'text-red-400',
  },
};

/**
 * Default style for slots without a rating.
 */
const DEFAULT_STYLE = {
  bg: 'bg-slate-700/30',
  border: 'border-slate-600/40',
  glow: '',
  text: 'text-slate-500',
};

/**
 * Disabled style for slots that are not applicable (e.g., off-hand with 2H weapon).
 */
const DISABLED_STYLE = {
  bg: 'bg-slate-800/20',
  border: 'border-slate-700/30',
  glow: '',
  text: 'text-slate-600',
};

/**
 * Slot configuration with icons and grid positions.
 * Layout forms a humanoid silhouette.
 */
interface SlotConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  gridArea: string;
}

const EQUIPMENT_SLOTS: SlotConfig[] = [
  { id: 'helmet', label: 'Helmet', icon: Crown, gridArea: 'helmet' },
  { id: 'weapon-1', label: 'Weapon', icon: Sword, gridArea: 'weapon1' },
  { id: 'body-armour', label: 'Body', icon: Shirt, gridArea: 'body' },
  { id: 'weapon-2', label: 'Off-Hand', icon: Shield, gridArea: 'weapon2' },
  { id: 'gloves', label: 'Gloves', icon: Hand, gridArea: 'gloves' },
  { id: 'ring-1', label: 'Ring 1', icon: CircleDot, gridArea: 'ring1' },
  { id: 'belt', label: 'Belt', icon: CircleDashed, gridArea: 'belt' },
  { id: 'ring-2', label: 'Ring 2', icon: CircleDot, gridArea: 'ring2' },
  { id: 'boots', label: 'Boots', icon: Footprints, gridArea: 'boots' },
  { id: 'amulet', label: 'Amulet', icon: Gem, gridArea: 'amulet' },
];

const FLASK_SLOTS: SlotConfig[] = [
  { id: 'flask-1', label: 'Flask 1', icon: FlaskConical, gridArea: 'f1' },
  { id: 'flask-2', label: 'Flask 2', icon: FlaskConical, gridArea: 'f2' },
  { id: 'flask-3', label: 'Flask 3', icon: FlaskConical, gridArea: 'f3' },
  { id: 'flask-4', label: 'Flask 4', icon: FlaskConical, gridArea: 'f4' },
  { id: 'flask-5', label: 'Flask 5', icon: FlaskConical, gridArea: 'f5' },
];

/**
 * Individual equipment slot component.
 */
function EquipmentSlot({
  config,
  rating,
  reason,
  onClick,
  disabled,
}: {
  config: SlotConfig;
  rating?: GearQualityRating;
  reason?: string;
  onClick?: () => void;
  /** True if slot is not applicable (e.g., off-hand with 2H weapon) */
  disabled?: boolean;
}) {
  // Disabled slots use a distinct grayed-out style
  const styles = disabled
    ? DISABLED_STYLE
    : rating
      ? RATING_STYLES[rating]
      : DEFAULT_STYLE;
  const isCritical = !disabled && rating === 'CRITICAL';
  const Icon = config.icon;

  // Build tooltip text
  const tooltipText = disabled
    ? `${config.label}: N/A (2H weapon equipped)`
    : reason
      ? `${config.label}: ${reason}`
      : `${config.label}${rating ? ` (${rating})` : ''}`;

  // Disabled slots don't respond to clicks
  const isClickable = onClick && !disabled;

  return (
    <motion.button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      title={tooltipText}
      className={cn(
        'relative flex items-center justify-center',
        'w-10 h-10 rounded-lg border',
        'transition-all duration-200',
        styles.bg,
        styles.border,
        styles.glow,
        isClickable && 'cursor-pointer hover:scale-110 hover:brightness-125',
        !isClickable && 'cursor-default',
        disabled && 'opacity-50'
      )}
      style={{ gridArea: config.gridArea }}
      // Pulsing animation for CRITICAL slots
      animate={
        isCritical
          ? {
              boxShadow: [
                '0 0 16px rgba(239,68,68,0.5)',
                '0 0 24px rgba(239,68,68,0.7)',
                '0 0 16px rgba(239,68,68,0.5)',
              ],
            }
          : undefined
      }
      transition={
        isCritical
          ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }
          : undefined
      }
    >
      <Icon className={cn('w-5 h-5', styles.text)} />
    </motion.button>
  );
}

/**
 * Find the rating for a specific slot by matching normalized slot names.
 */
function findRatingForSlot(
  slotId: string,
  gearRatings: GearSlotRating[]
): GearSlotRating | undefined {
  const normalizedSlotId = normalizeSlotForMatching(slotId);

  return gearRatings.find((rating) => {
    const normalizedRatingSlot = normalizeSlotForMatching(rating.slot);
    return normalizedRatingSlot === normalizedSlotId;
  });
}

export function EquipmentGrid({ gearRatings, isTwoHanded, onSlotClick }: EquipmentGridProps) {
  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Main equipment grid - mannequin layout */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateAreas: `
            ".       helmet  ."
            "weapon1 body    weapon2"
            ".       gloves  ."
            "ring1   belt    ring2"
            ".       boots   ."
            ".       amulet  ."
          `,
          gridTemplateColumns: 'auto auto auto',
          gridTemplateRows: 'repeat(6, auto)',
        }}
      >
        {EQUIPMENT_SLOTS.map((slot) => {
          const ratingData = findRatingForSlot(slot.id, gearRatings);
          // Off-hand slot is disabled when using a two-handed weapon
          const isOffHandDisabled = slot.id === 'weapon-2' && isTwoHanded;
          return (
            <EquipmentSlot
              key={slot.id}
              config={slot}
              rating={ratingData?.rating}
              reason={ratingData?.reason}
              onClick={onSlotClick ? () => onSlotClick(slot.id) : undefined}
              disabled={isOffHandDisabled}
            />
          );
        })}
      </div>

      {/* Flask row */}
      <div className="flex items-center gap-2">
        {FLASK_SLOTS.map((slot) => {
          const ratingData = findRatingForSlot(slot.id, gearRatings);
          return (
            <EquipmentSlot
              key={slot.id}
              config={slot}
              rating={ratingData?.rating}
              reason={ratingData?.reason}
              onClick={onSlotClick ? () => onSlotClick(slot.id) : undefined}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-xs">
        {(Object.keys(RATING_STYLES) as GearQualityRating[]).map((rating) => (
          <div key={rating} className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                RATING_STYLES[rating].bg,
                'border',
                RATING_STYLES[rating].border
              )}
            />
            <span className={cn('capitalize', RATING_STYLES[rating].text)}>
              {rating.toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EquipmentGrid;
