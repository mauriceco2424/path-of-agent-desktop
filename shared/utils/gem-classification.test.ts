/**
 * Tests for Gem Classification Utilities
 */
import { describe, it, expect } from 'vitest';
import {
  isAuraGem,
  isSupportGem,
  extractMainSkill,
  getMainSkillForBuild,
  extractAurasFromGroups,
  SocketGroupInfo,
} from './gem-classification';

describe('isAuraGem', () => {
  it('should identify common auras', () => {
    expect(isAuraGem('Determination')).toBe(true);
    expect(isAuraGem('Grace')).toBe(true);
    expect(isAuraGem('Discipline')).toBe(true);
    expect(isAuraGem('Vitality')).toBe(true);
    expect(isAuraGem('Hatred')).toBe(true);
    expect(isAuraGem('Wrath')).toBe(true);
    expect(isAuraGem('Anger')).toBe(true);
    expect(isAuraGem('Malevolence')).toBe(true);
    expect(isAuraGem('Zealotry')).toBe(true);
    expect(isAuraGem('Pride')).toBe(true);
  });

  it('should identify heralds', () => {
    expect(isAuraGem('Herald of Ash')).toBe(true);
    expect(isAuraGem('Herald of Ice')).toBe(true);
    expect(isAuraGem('Herald of Thunder')).toBe(true);
    expect(isAuraGem('Herald of Purity')).toBe(true);
    expect(isAuraGem('Herald of Agony')).toBe(true);
  });

  it('should identify purity auras', () => {
    expect(isAuraGem('Purity of Elements')).toBe(true);
    expect(isAuraGem('Purity of Fire')).toBe(true);
    expect(isAuraGem('Purity of Ice')).toBe(true);
    expect(isAuraGem('Purity of Lightning')).toBe(true);
  });

  it('should identify banners', () => {
    expect(isAuraGem('Defiance Banner')).toBe(true);
    expect(isAuraGem('Dread Banner')).toBe(true);
    expect(isAuraGem('War Banner')).toBe(true);
  });

  it('should identify aspect skills', () => {
    expect(isAuraGem('Aspect of the Spider')).toBe(true);
    expect(isAuraGem('Aspect of the Cat')).toBe(true);
    expect(isAuraGem('Aspect of the Crab')).toBe(true);
    expect(isAuraGem('Aspect of the Avian')).toBe(true);
  });

  it('should identify other aura-like skills', () => {
    expect(isAuraGem('Tempest Shield')).toBe(true);
    expect(isAuraGem('Arctic Armour')).toBe(true);
    expect(isAuraGem('Clarity')).toBe(true);
    expect(isAuraGem('Precision')).toBe(true);
    expect(isAuraGem('Haste')).toBe(true);
  });

  it('should identify warcries as non-main skills', () => {
    expect(isAuraGem('Rallying Cry')).toBe(true);
    expect(isAuraGem('Intimidating Cry')).toBe(true);
    expect(isAuraGem('Seismic Cry')).toBe(true);
    expect(isAuraGem('Enduring Cry')).toBe(true);
    expect(isAuraGem('Ancestral Cry')).toBe(true);
    expect(isAuraGem('Infernal Cry')).toBe(true);
    expect(isAuraGem("Battlemage's Cry")).toBe(true);
    expect(isAuraGem("General's Cry")).toBe(true);
    expect(isAuraGem('Overexertion')).toBe(true);
    expect(isAuraGem('Autoexertion')).toBe(true);
  });

  it('should identify trigger/automation skills as non-main skills', () => {
    expect(isAuraGem('Automation')).toBe(true);
    expect(isAuraGem('Spellslinger')).toBe(true);
    expect(isAuraGem('Temporal Rift')).toBe(true);
    expect(isAuraGem('Protective Link')).toBe(true);
    expect(isAuraGem('Death Walk')).toBe(true);
  });

  it('should identify guard skills as non-main skills', () => {
    expect(isAuraGem('Molten Shell')).toBe(true);
    expect(isAuraGem('Vaal Molten Shell')).toBe(true);
    expect(isAuraGem('Steelskin')).toBe(true);
    expect(isAuraGem('Immortal Call')).toBe(true);
    expect(isAuraGem('Bone Armour')).toBe(true);
  });

  it('should identify movement skills as non-main skills', () => {
    expect(isAuraGem('Flame Dash')).toBe(true);
    expect(isAuraGem('Frostblink')).toBe(true);
    expect(isAuraGem('Leap Slam')).toBe(true);
    expect(isAuraGem('Whirling Blades')).toBe(true);
    expect(isAuraGem('Shield Charge')).toBe(true);
    expect(isAuraGem('Dash')).toBe(true);
    expect(isAuraGem('Phase Run')).toBe(true);
  });

  it('should identify utility skills as non-main skills', () => {
    expect(isAuraGem('Blood Rage')).toBe(true);
    expect(isAuraGem('Convocation')).toBe(true);
    expect(isAuraGem('Desecrate')).toBe(true);
    expect(isAuraGem('Bone Offering')).toBe(true);
    expect(isAuraGem('Flesh Offering')).toBe(true);
    expect(isAuraGem('Spirit Offering')).toBe(true);
    expect(isAuraGem('Momentum')).toBe(true);
    expect(isAuraGem('Fortify')).toBe(true);
  });

  it('should identify curses as non-main skills', () => {
    expect(isAuraGem('Assassin\'s Mark')).toBe(true);
    expect(isAuraGem('Vulnerability')).toBe(true);
    expect(isAuraGem('Despair')).toBe(true);
    expect(isAuraGem('Enfeeble')).toBe(true);
    expect(isAuraGem('Temporal Chains')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isAuraGem('DETERMINATION')).toBe(true);
    expect(isAuraGem('determination')).toBe(true);
    expect(isAuraGem('Determination')).toBe(true);
    expect(isAuraGem('dEtErMiNaTiOn')).toBe(true);
  });

  it('should NOT identify damage skills as auras', () => {
    expect(isAuraGem('Summon Holy Relic of Conviction')).toBe(false);
    expect(isAuraGem('Kinetic Blast')).toBe(false);
    expect(isAuraGem('Raise Spectre')).toBe(false);
    expect(isAuraGem('Arc')).toBe(false);
    expect(isAuraGem('Cyclone')).toBe(false);
    expect(isAuraGem('Lightning Arrow')).toBe(false);
    expect(isAuraGem('Fireball')).toBe(false);
    expect(isAuraGem('Ice Shot')).toBe(false);
    expect(isAuraGem('Blade Vortex')).toBe(false);
  });

  it('should handle empty/null inputs', () => {
    expect(isAuraGem('')).toBe(false);
    expect(isAuraGem(null as any)).toBe(false);
    expect(isAuraGem(undefined as any)).toBe(false);
  });
});

describe('isSupportGem', () => {
  it('should identify support gems', () => {
    expect(isSupportGem('Minion Damage Support')).toBe(true);
    expect(isSupportGem('Brutality Support')).toBe(true);
    expect(isSupportGem('Empower Support')).toBe(true);
    expect(isSupportGem('Awakened Elemental Damage with Attacks Support')).toBe(true);
  });

  it('should NOT identify active skills as supports', () => {
    expect(isSupportGem('Cyclone')).toBe(false);
    expect(isSupportGem('Arc')).toBe(false);
    expect(isSupportGem('Determination')).toBe(false);
  });
});

describe('extractMainSkill', () => {
  it('should extract main skill from skills array', () => {
    const group: SocketGroupInfo = {
      enabled: true,
      skills: ['Cyclone', 'Brutality Support', 'Melee Physical Damage Support'],
    };
    expect(extractMainSkill(group)).toBe('Cyclone');
  });

  it('should skip auras when extracting main skill', () => {
    const group: SocketGroupInfo = {
      enabled: true,
      skills: ['Determination', 'Arc', 'Brutality Support'],
    };
    expect(extractMainSkill(group)).toBe('Arc');
  });

  it('should skip all auras if group is aura-only', () => {
    const group: SocketGroupInfo = {
      enabled: true,
      skills: ['Determination', 'Grace', 'Discipline'],
    };
    expect(extractMainSkill(group)).toBeNull();
  });

  it('should return first valid skill from skills array (mainActiveSkill not used for skills array)', () => {
    const group: SocketGroupInfo = {
      enabled: true,
      skills: ['Vaal Cyclone', 'Cyclone', 'Brutality Support'],
      mainActiveSkill: 1,
    };
    // mainActiveSkill is an index into displaySkillList, not skills array
    // So we return the first non-aura, non-support skill: Vaal Cyclone
    expect(extractMainSkill(group)).toBe('Vaal Cyclone');
  });

  it('should skip mainActiveSkill if it points to an aura', () => {
    const group: SocketGroupInfo = {
      enabled: true,
      skills: ['Determination', 'Arc', 'Brutality Support'],
      mainActiveSkill: 0, // Points to Determination
    };
    // Should fall back to Arc
    expect(extractMainSkill(group)).toBe('Arc');
  });

  it('should handle gemList format', () => {
    const group: SocketGroupInfo = {
      enabled: true,
      gemList: [
        { enabled: true, nameSpec: 'Summon Holy Relic of Conviction', isSupport: false },
        { enabled: true, nameSpec: 'Minion Damage Support', isSupport: true },
        { enabled: true, nameSpec: 'Empower Support', isSupport: true },
      ],
    };
    expect(extractMainSkill(group)).toBe('Summon Holy Relic of Conviction');
  });

  it('should skip auras in gemList', () => {
    const group: SocketGroupInfo = {
      enabled: true,
      gemList: [
        { enabled: true, nameSpec: 'Determination', isSupport: false },
        { enabled: true, nameSpec: 'Kinetic Blast', isSupport: false },
        { enabled: true, nameSpec: 'Greater Multiple Projectiles Support', isSupport: true },
      ],
    };
    expect(extractMainSkill(group)).toBe('Kinetic Blast');
  });

  it('should return null for disabled groups', () => {
    const group: SocketGroupInfo = {
      enabled: false,
      skills: ['Cyclone', 'Brutality Support'],
    };
    expect(extractMainSkill(group)).toBeNull();
  });

  it('should return null for empty groups', () => {
    expect(extractMainSkill({ skills: [] })).toBeNull();
    expect(extractMainSkill({ gemList: [] })).toBeNull();
    expect(extractMainSkill({})).toBeNull();
    expect(extractMainSkill(null as any)).toBeNull();
  });
});

describe('getMainSkillForBuild', () => {
  it('should find main skill from main socket group', () => {
    const groups: SocketGroupInfo[] = [
      { index: 0, enabled: true, skills: ['Determination', 'Grace'] },
      { index: 1, enabled: true, skills: ['Cyclone', 'Brutality Support'] },
    ];
    const result = getMainSkillForBuild(groups, 1);
    expect(result.skill).toBe('Cyclone');
    expect(result.isSpecialCase).toBe(false);
  });

  it('should scan all groups if main socket group has no valid skill', () => {
    const groups: SocketGroupInfo[] = [
      { index: 0, enabled: true, skills: ['Determination', 'Grace'] },
      { index: 1, enabled: true, skills: ['Arc', 'Elemental Focus Support'] },
    ];
    const result = getMainSkillForBuild(groups, 0); // Points to aura-only group
    expect(result.skill).toBe('Arc');
    expect(result.isSpecialCase).toBe(false);
  });

  it('should use fallback activeSkill if no valid skill in groups', () => {
    const groups: SocketGroupInfo[] = [
      { index: 0, enabled: true, skills: ['Determination', 'Grace'] },
    ];
    const result = getMainSkillForBuild(groups, 0, 'Kinetic Blast');
    expect(result.skill).toBe('Kinetic Blast');
    expect(result.isSpecialCase).toBe(false);
  });

  it('should NOT use fallback if fallback is an aura', () => {
    const groups: SocketGroupInfo[] = [
      { index: 0, enabled: true, skills: ['Determination', 'Grace'] },
    ];
    const result = getMainSkillForBuild(groups, 0, 'Malevolence');
    expect(result.skill).toBe('Aurabot');
    expect(result.isSpecialCase).toBe(true);
    expect(result.specialCaseType).toBe('aurabot');
  });

  it('should identify aurabot builds', () => {
    const groups: SocketGroupInfo[] = [
      { index: 0, enabled: true, skills: ['Determination', 'Grace', 'Discipline'] },
      { index: 1, enabled: true, skills: ['Vitality', 'Clarity'] },
      { index: 2, enabled: true, skills: ['Hatred', 'Zealotry'] },
    ];
    const result = getMainSkillForBuild(groups);
    expect(result.skill).toBe('Aurabot');
    expect(result.isSpecialCase).toBe(true);
    expect(result.specialCaseType).toBe('aurabot');
  });

  it('should return Unknown for empty groups', () => {
    const result = getMainSkillForBuild([]);
    expect(result.skill).toBe('Unknown');
    expect(result.isSpecialCase).toBe(true);
    expect(result.specialCaseType).toBe('unknown');
  });

  it('should return Unknown for null groups', () => {
    const result = getMainSkillForBuild(null as any);
    expect(result.skill).toBe('Unknown');
    expect(result.isSpecialCase).toBe(true);
  });

  it('should skip disabled groups', () => {
    const groups: SocketGroupInfo[] = [
      { index: 0, enabled: false, skills: ['Cyclone', 'Brutality Support'] },
      { index: 1, enabled: true, skills: ['Arc', 'Elemental Focus Support'] },
    ];
    const result = getMainSkillForBuild(groups);
    expect(result.skill).toBe('Arc');
    expect(result.isSpecialCase).toBe(false);
  });
});

describe('extractAurasFromGroups', () => {
  it('should extract auras from multiple groups', () => {
    const groups: SocketGroupInfo[] = [
      { enabled: true, skills: ['Determination', 'Grace'] },
      { enabled: true, skills: ['Cyclone', 'Brutality Support'] },
      { enabled: true, skills: ['Vitality', 'Herald of Ash'] },
    ];
    const auras = extractAurasFromGroups(groups);
    expect(auras).toContain('Determination');
    expect(auras).toContain('Grace');
    expect(auras).toContain('Vitality');
    expect(auras).toContain('Herald of Ash');
    expect(auras).not.toContain('Cyclone');
    expect(auras).not.toContain('Brutality Support');
  });

  it('should deduplicate auras', () => {
    const groups: SocketGroupInfo[] = [
      { enabled: true, skills: ['Determination'] },
      { enabled: true, skills: ['Determination'] },
    ];
    const auras = extractAurasFromGroups(groups);
    expect(auras).toHaveLength(1);
    expect(auras).toContain('Determination');
  });

  it('should skip disabled groups', () => {
    const groups: SocketGroupInfo[] = [
      { enabled: false, skills: ['Determination'] },
      { enabled: true, skills: ['Grace'] },
    ];
    const auras = extractAurasFromGroups(groups);
    expect(auras).not.toContain('Determination');
    expect(auras).toContain('Grace');
  });

  it('should work with gemList format', () => {
    const groups: SocketGroupInfo[] = [
      {
        enabled: true,
        gemList: [
          { enabled: true, nameSpec: 'Determination', isSupport: false },
          { enabled: true, nameSpec: 'Brutality Support', isSupport: true },
        ],
      },
    ];
    const auras = extractAurasFromGroups(groups);
    expect(auras).toContain('Determination');
    expect(auras).not.toContain('Brutality Support');
  });
});
