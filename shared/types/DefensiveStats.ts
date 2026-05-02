/**
 * Defensive stats snapshot used across UI and services.
 * All fields are optional to accommodate partial data in mocks and previews.
 */
export interface DefensiveStats {
  life?: number;
  energyShield?: number;
  mana?: number;

  fireResistance?: number;
  coldResistance?: number;
  lightningResistance?: number;
  chaosResistance?: number;

  armour?: number;
  armor?: number;
  evasion?: number;

  blockChance?: number;
  spellBlockChance?: number;
  dodgeChance?: number;
  spellDodgeChance?: number;
  spellSuppressionChance?: number;
  spellSuppression?: number;

  maximumPhysicalHit?: number;
  maximumFireHit?: number;
  maximumColdHit?: number;
  maximumLightningHit?: number;
  maximumChaosHit?: number;

  lifeRegeneration?: number;
  energyShieldRecharge?: number;

  [key: string]: unknown;
}
