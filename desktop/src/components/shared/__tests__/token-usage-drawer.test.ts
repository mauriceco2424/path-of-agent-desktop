import { describe, expect, it } from 'vitest';
import type { PhaseTokenBreakdown } from '@shared/types/TokenUsage';
import { shouldShowReasoningRow } from '../TokenUsageDrawer';

function makePhase(overrides: Partial<PhaseTokenBreakdown> = {}): PhaseTokenBreakdown {
  return {
    contextInputTokens: 0,
    reasoningTokens: 0,
    toolCallInputTokens: 0,
    toolCallOutputTokens: 0,
    finalOutputTokens: 0,
    ...overrides,
  };
}

describe('TokenUsageDrawer reasoning visibility', () => {
  it('returns false when aggregate reasoning is zero', () => {
    const phases = [
      makePhase({ contextInputTokens: 100, finalOutputTokens: 20 }),
      makePhase({ contextInputTokens: 80, finalOutputTokens: 15 }),
    ];

    expect(shouldShowReasoningRow(phases)).toBe(false);
  });

  it('returns true when any pathway has reasoning tokens', () => {
    const phases = [
      makePhase({ contextInputTokens: 100, finalOutputTokens: 20 }),
      makePhase({ contextInputTokens: 80, finalOutputTokens: 15, reasoningTokens: 7 }),
    ];

    expect(shouldShowReasoningRow(phases)).toBe(true);
  });
});
