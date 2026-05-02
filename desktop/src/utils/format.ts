/**
 * Formatting utilities for displaying build statistics
 *
 * Extracted from OverviewStatsPanel for reuse across components
 */

/**
 * Format large numbers with K/M/B suffixes for compact display
 *
 * @example
 * formatNumber(1500) // "1.5K"
 * formatNumber(2500000) // "2.5M"
 * formatNumber(500) // "500"
 */
export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format percentage values with configurable decimal places
 *
 * @param value - The percentage value (e.g., 75.5 for 75.5%)
 * @param decimals - Number of decimal places (default: 1)
 *
 * @example
 * formatPercent(75.5) // "75.5%"
 * formatPercent(100, 0) // "100%"
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format DPS values with appropriate suffix and styling considerations
 * Uses shorter format for very large numbers
 *
 * @example
 * formatDps(316000) // "316K"
 * formatDps(1200000) // "1.2M"
 * formatDps(850) // "850"
 */
export function formatDps(value: number): string {
  if (value >= 1_000_000_000) {
    const formatted = value / 1_000_000_000;
    // Use more precision for smaller values
    return formatted >= 10
      ? `${formatted.toFixed(0)}B`
      : `${formatted.toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    const formatted = value / 1_000_000;
    return formatted >= 10
      ? `${formatted.toFixed(0)}M`
      : `${formatted.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const formatted = value / 1_000;
    return formatted >= 100
      ? `${formatted.toFixed(0)}K`
      : `${formatted.toFixed(1)}K`;
  }
  return Math.round(value).toLocaleString();
}

/**
 * Format a life/ES pool value compactly
 * Shows full number for values under 10K, otherwise uses suffix
 *
 * @example
 * formatPool(5500) // "5,500"
 * formatPool(12000) // "12K"
 */
export function formatPool(value: number): string {
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString();
}

/**
 * Truncate text with ellipsis if it exceeds maxLength
 *
 * @example
 * truncateText("Vaal Lightning Strike", 15) // "Vaal Lightning..."
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}
