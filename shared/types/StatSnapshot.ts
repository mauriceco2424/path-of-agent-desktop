/**
 * A snapshot of key build statistics used for context building
 * Contains the essential numeric values from a build analysis
 */
export interface StatSnapshot {
  /** Total damage per second */
  totalDPS: number;
  /** Boss damage per second (single-target) */
  bossDPS?: number;
  /** Effective hit points (combined defenses) */
  effectiveHP: number;
  /** Base life pool */
  life: number;
  /** Energy shield pool */
  energyShield: number;
  /** Mana pool */
  mana?: number;
  /** Fire resistance percentage */
  fireRes: number;
  /** Cold resistance percentage */
  coldRes: number;
  /** Lightning resistance percentage */
  lightningRes: number;
  /** Chaos resistance percentage */
  chaosRes: number;
  /** Armour value */
  armour?: number;
  /** Evasion rating */
  evasion?: number;
  /** Block chance (%) */
  blockChance?: number;
  /** Spell block chance (%) */
  spellBlockChance?: number;
  /** Spell suppression chance (%) */
  spellSuppression?: number;
  /** Attack dodge chance (%) */
  dodgeChance?: number;
  /** Spell dodge chance (%) */
  spellDodgeChance?: number;
}
