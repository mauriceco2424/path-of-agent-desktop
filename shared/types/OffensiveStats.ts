/**
 * Offensive stats snapshot used in build summary UI.
 */
export interface OffensiveStats {
  dps?: number;
  critChance?: number;
  critMultiplier?: number;

  attackRate?: number | null;
  castRate?: number | null;
  hitChance?: number | null;

  physicalDps?: number;
  fireDps?: number;
  coldDps?: number;
  lightningDps?: number;
  chaosDps?: number;

  withIgniteDPS?: number;
  withPoisonDPS?: number;
  withBleedDPS?: number;
  totalDotDPS?: number;
  /** Legacy name for total DPS to satisfy older samples */
  totalDps?: number;
  speed?: number;
  [key: string]: unknown;
}
