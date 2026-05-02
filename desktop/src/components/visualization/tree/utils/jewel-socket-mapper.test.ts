import { describe, expect, it } from 'vitest';
import { extractEquippedJewels } from './jewel-socket-mapper';

describe('extractEquippedJewels', () => {
  it('maps current PoB standard radius indices correctly', () => {
    const jewels = extractEquippedJewels([
      {
        slot: 'Jewel 26725',
        name: 'Measured Eye',
        baseName: 'Cobalt Jewel',
        rarity: 'Rare',
        jewelRadiusIndex: 5,
        mods: {
          explicits: [{ text: '12% increased Spell Damage' }],
        },
      },
    ]);

    expect(jewels.get(26725)?.radiusLabel).toBe('Massive');
    expect(jewels.get(26725)?.radiusIndex).toBe(5);
  });

  it('infers current Thread of Hope annulus indices from mods', () => {
    const jewels = extractEquippedJewels([
      {
        slot: 'Jewel 33989',
        name: 'Thread of Hope',
        baseName: 'Crimson Jewel',
        rarity: 'Unique',
        jewelRadiusLabel: 'Variable',
        mods: {
          explicits: [{ text: 'Only affects Passives in Large Ring' }],
        },
      },
    ]);

    expect(jewels.get(33989)?.isThreadOfHope).toBe(true);
    expect(jewels.get(33989)?.radiusLabel).toBe('Large');
    expect(jewels.get(33989)?.radiusIndex).toBe(8);
  });

  it('extracts the Impossible Escape keystone target from jewel stats', () => {
    const jewels = extractEquippedJewels([
      {
        slot: 'Jewel 55114',
        name: 'Impossible Escape',
        baseName: 'Viridian Jewel',
        rarity: 'Unique',
        mods: {
          explicits: [
            {
              text: 'Passives in Radius of Chaos Inoculation can be Allocated without being connected to your tree',
            },
          ],
        },
      },
    ]);

    expect(jewels.get(55114)?.impossibleEscapeKeystoneName).toBe('Chaos Inoculation');
  });
});
