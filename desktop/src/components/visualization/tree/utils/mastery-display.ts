import type { MasteryEffect, TreeNode } from '../hooks/useTreeData';

export interface TooltipMasteryDisplay {
  masteryEffects?: MasteryEffect[];
  selectedMasteryEffect?: MasteryEffect;
}

function normalizeLines(lines: string[] | undefined): string[] {
  return Array.isArray(lines)
    ? lines
      .filter((line): line is string => typeof line === 'string')
      .map((line) => line.trim())
      .filter(Boolean)
    : [];
}

function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const normalizedA = normalizeLines(a);
  const normalizedB = normalizeLines(b);

  if (normalizedA.length !== normalizedB.length) {
    return false;
  }

  return normalizedA.every((line, index) => line === normalizedB[index]);
}

export function resolveTooltipMasteryDisplay(
  node: TreeNode,
  masterySelections?: Record<number, number>,
): TooltipMasteryDisplay {
  if (node.type !== 'mastery') {
    return {};
  }

  const effectId = masterySelections?.[node.id];
  const selectedMasteryEffect = effectId !== undefined && node.masteryEffects
    ? node.masteryEffects.find((effect) => effect.effect === effectId)
    : undefined;

  const hasOverrideBackedStats = normalizeLines(node.stats).length > 0
    && (
      !selectedMasteryEffect
      || !arraysEqual(node.stats, selectedMasteryEffect.stats)
      || !arraysEqual(node.reminderText, selectedMasteryEffect.reminderText)
    );

  if (hasOverrideBackedStats) {
    const syntheticEffect: MasteryEffect = {
      effect: effectId ?? node.id,
      stats: normalizeLines(node.stats),
      reminderText: normalizeLines(node.reminderText).length > 0
        ? normalizeLines(node.reminderText)
        : undefined,
    };

    return {
      masteryEffects: [syntheticEffect],
      selectedMasteryEffect: syntheticEffect,
    };
  }

  return {
    masteryEffects: node.masteryEffects,
    selectedMasteryEffect,
  };
}
