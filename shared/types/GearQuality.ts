/**
 * Gear Quality Rating Types
 *
 * LLM-generated quality ratings for gear slots.
 */

export type GearQualityRating = 'GOOD' | 'AVERAGE' | 'POOR' | 'CRITICAL';

export interface GearSlotRating {
  slot: string;
  rating: GearQualityRating;
  reason?: string;
}

export interface GearSlotRatings {
  ratings: GearSlotRating[];
  generatedAt: number;
  /** True if build uses a two-handed weapon (off-hand slot is N/A) */
  isTwoHanded?: boolean;
}
