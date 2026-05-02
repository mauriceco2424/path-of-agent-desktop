/**
 * Credit System Constants and Types
 *
 * Defines the conversion between USD token costs and user-facing credits.
 * 1 credit = $0.008 in token cost (20% margin on pack pricing).
 *
 * Gating: operations require a minimum credit balance upfront.
 * If actual cost exceeds balance, the operation finishes but the user
 * cannot start new operations until they top up.
 */

/** 1 credit = $0.008 in token cost (20% margin: user pays ~$0.01/credit) */
export const CREDIT_COST_USD = 0.008;

/** Minimum credits required to start a unified analysis */
export const MIN_CREDITS_PER_PATHWAY = 60;

/** Minimum credits required to send a follow-up chat message */
export const MIN_CREDITS_FOLLOW_UP = 10;

/** Minimum credits required for config micro-agent calibration */
export const MIN_CREDITS_CONFIG = 5;

/** Maximum allowed negative balance during analysis. If balance drops to this or below, analysis is interrupted. */
export const CREDIT_OVERDRAFT_LIMIT = -10;

/** Estimate the credit cost for an analysis based on pathway count */
export function estimateAnalysisCost(pathwayCount: number): number {
  return pathwayCount * MIN_CREDITS_PER_PATHWAY;
}

/** Convert USD cost to credits (always rounds DOWN to favor the user) */
export function usdToCredits(costUsd: number): number {
  return Math.floor(costUsd / CREDIT_COST_USD);
}

/** Convert credits to approximate USD (for internal calculations) */
export function creditsToUsd(credits: number): number {
  return credits * CREDIT_COST_USD;
}

/** Credit deduction info sent via SSE after analysis completes */
export interface CreditDeductionEvent {
  creditsDeducted: number;
  creditsRemaining: number;
  costUsd: number;
}
