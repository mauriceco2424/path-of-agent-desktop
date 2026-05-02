import { describe, expect, it } from 'vitest';
import {
  findSpriteCategoryForIcon,
  getRepresentativeSpriteIconSize,
  getAscendancyClassSpriteKey,
  getFrameTextureCategory,
  normalizeSpriteIconPath,
  normalizeAscendancyName,
  resolveSpriteInfo,
  selectZoomLevel,
} from './sprite-resolver';
import type { RenderableNode, SpriteConfig } from '../types';

function createNode(overrides: Partial<RenderableNode> = {}): RenderableNode {
  return {
    id: 1,
    name: 'Node',
    stats: [],
    x: 0,
    y: 0,
    type: 'small',
    isKeystone: false,
    isNotable: false,
    isMastery: false,
    isJewelSocket: false,
    isAscendancyStart: false,
    connections: [],
    icon: 'Art/2DArt/SkillIcons/passives/damage.png',
    ...overrides,
  };
}

describe('sprite resolver', () => {
  it('normalizes sprite icon paths to forward slashes', () => {
    expect(normalizeSpriteIconPath('Art\\2DArt\\SkillIcons\\passives\\Corruption.png'))
      .toBe('Art/2DArt/SkillIcons/passives/Corruption.png');
  });

  it('normalizes Raider to Warden for comparisons', () => {
    expect(normalizeAscendancyName('Raider')).toBe('Warden');
    expect(normalizeAscendancyName('Pathfinder')).toBe('Pathfinder');
  });

  it('maps Warden to the legacy Ranger portrait asset key', () => {
    expect(getAscendancyClassSpriteKey('Warden')).toBe('ClassesRaider');
    expect(getAscendancyClassSpriteKey('Raider')).toBe('ClassesRaider');
    expect(getAscendancyClassSpriteKey('Pathfinder')).toBe('ClassesPathfinder');
  });

  it('routes ascendancy frames to the ascendancy sprite sheet', () => {
    expect(getFrameTextureCategory('AscendancyFrameLargeNormal')).toBe('ascendancy');
    expect(getFrameTextureCategory('AscendancyFrameSmallAllocated')).toBe('ascendancy');
    expect(getFrameTextureCategory('NotableFrameUnallocated')).toBe('frame');
  });

  it('uses the ascendancy middle sprite for ascendancy start nodes', () => {
    const node = createNode({
      isAscendancyStart: true,
      ascendancyName: 'Pathfinder',
    });

    const result = resolveSpriteInfo(node, false);

    expect(result.iconCategory).toBe('ascendancy');
    expect(result.iconKey).toBe('AscendancyMiddle');
    expect(result.frameKey).toBeNull();
  });

  it('uses active and inactive mastery art keys based on allocation state', () => {
    const node = createNode({
      type: 'mastery',
      isMastery: true,
      inactiveIcon: 'inactive.png',
      activeIcon: 'active.png',
    });

    const inactiveResult = resolveSpriteInfo(node, false);
    const activeResult = resolveSpriteInfo(node, true);

    expect(inactiveResult.iconKey).toBe('inactive.png');
    expect(activeResult.iconKey).toBe('active.png');
  });

  it('finds a fallback sprite category when the preferred one does not contain the icon', () => {
    const spriteConfig: SpriteConfig = {
      keystoneActive: {
        '0.3835': {
          filename: 'keystone.png',
          w: 100,
          h: 100,
          coords: {},
        },
      },
      notableActive: {
        '0.3835': {
          filename: 'notable.png',
          w: 100,
          h: 100,
          coords: {
            'Art/2DArt/SkillIcons/passives/Corruption.png': {
              x: 0,
              y: 0,
              w: 17,
              h: 17,
            },
          },
        },
      },
    };

    expect(
      findSpriteCategoryForIcon(
        'Art/2DArt/SkillIcons/passives/Corruption.png',
        spriteConfig,
        '0.3835',
        ['keystoneActive']
      )
    ).toBe('notableActive');
  });

  it('returns a representative icon size for a sprite category', () => {
    const spriteConfig: SpriteConfig = {
      keystoneActive: {
        '0.3835': {
          filename: 'keystone.png',
          w: 100,
          h: 100,
          coords: {
            'Art/2DArt/SkillIcons/passives/Example.png': {
              x: 0,
              y: 0,
              w: 69,
              h: 69,
            },
          },
        },
      },
    };

    expect(getRepresentativeSpriteIconSize(spriteConfig, 'keystoneActive', '0.3835')).toEqual({
      width: 69,
      height: 69,
    });
  });

  it('matches PoB by preferring the modern 0.3835 sprite sheet when available', () => {
    expect(selectZoomLevel(1, [0.1246, 0.2109, 0.2972, 0.3835, 0.5])).toBe('0.3835');
  });

  it('falls back to the largest sheet for legacy sprite sets without 0.3835', () => {
    expect(selectZoomLevel(1, [0.1246, 0.2109, 0.2972])).toBe('0.2972');
  });
});
