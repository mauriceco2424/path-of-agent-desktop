import { describe, expect, it } from 'vitest';
import { resolveTooltipMasteryDisplay } from './mastery-display';
import type { TreeNode } from '../hooks/useTreeData';

function createMasteryNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: 101,
    x: 0,
    y: 0,
    type: 'mastery',
    name: 'Life Mastery',
    stats: [],
    masteryEffects: [
      { effect: 5001, stats: ['+30 to maximum Life'] },
      { effect: 5002, stats: ['10% increased maximum Life'] },
    ],
    ...overrides,
  };
}

describe('resolveTooltipMasteryDisplay', () => {
  it('returns the selected static mastery effect when no live override is present', () => {
    const result = resolveTooltipMasteryDisplay(
      createMasteryNode(),
      { 101: 5001 },
    );

    expect(result.selectedMasteryEffect).toEqual({
      effect: 5001,
      stats: ['+30 to maximum Life'],
    });
    expect(result.masteryEffects).toEqual([
      { effect: 5001, stats: ['+30 to maximum Life'] },
      { effect: 5002, stats: ['10% increased maximum Life'] },
    ]);
  });

  it('collapses to a synthetic single effect when the mastery is backed by runegraft override stats', () => {
    const result = resolveTooltipMasteryDisplay(
      createMasteryNode({
        name: 'Runegraft of the Fortress',
        stats: [
          '10% reduced Attributes',
          '40% increased Global Defences',
        ],
        reminderText: ['Limited to 1 Runegraft of the Fortress'],
      }),
      { 101: 5001 },
    );

    expect(result.selectedMasteryEffect).toEqual({
      effect: 5001,
      stats: [
        '10% reduced Attributes',
        '40% increased Global Defences',
      ],
      reminderText: ['Limited to 1 Runegraft of the Fortress'],
    });
    expect(result.masteryEffects).toEqual([
      {
        effect: 5001,
        stats: [
          '10% reduced Attributes',
          '40% increased Global Defences',
        ],
        reminderText: ['Limited to 1 Runegraft of the Fortress'],
      },
    ]);
  });
});
