/**
 * PriceSnapshot Interface
 * Represents a price snapshot from poe.ninja or trade API
 */

export interface PriceSnapshot {
  item: {
    name: string;
    type?: string;
  };

  chaosValue: number;
  divineValue?: number;

  league: string;
  source: 'poe.ninja' | 'trade_api';
  confidence: 'high' | 'medium' | 'low';
  degraded: boolean;

  timestamp: string;
  age: number;

  listingCount?: number;
  minPrice?: number;
  maxPrice?: number;
}
