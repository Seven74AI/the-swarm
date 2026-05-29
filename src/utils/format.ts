/**
 * Format cache: avoids repeated formatting of the same number value.
 * Map<number, string> for O(1) lookup on repeated values.
 * All values >= 1000 are cached (thousands commas, M/B suffixes, scientific).
 * #22: Added format cache for performance.
 */
const formatCache = new Map<number, string>();
const FORMAT_CACHE_MAX_SIZE = 1000;

function cachedFormat(n: number, formatter: (n: number) => string): string {
  // Use Math.floor for integer cache keys
  const key = Number.isInteger(n) ? n : Math.floor(n);
  const cached = formatCache.get(key);
  if (cached !== undefined) return cached;

  const result = formatter(n);
  formatCache.set(key, result);

  // Evict oldest entries if cache grows too large
  if (formatCache.size > FORMAT_CACHE_MAX_SIZE) {
    const keys = formatCache.keys();
    for (let i = 0; i < 100; i++) {
      const k = keys.next();
      if (k.done) break;
      formatCache.delete(k.value);
    }
  }

  return result;
}

/** Clear the format cache (useful for testing) */
export function clearFormatCache(): void {
  formatCache.clear();
}

/**
 * Format a small rate/decimal for display.
 * <1: 1 decimal (0.2, 0.8)
 * <10: 1 decimal (3.5)
 * >=10: integer (42)
 */
export function formatRate(n: number): string {
  if (n < 1) return n.toFixed(1);
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString('en-US');
}

/**
 * Format a number for display with abbreviations (#24).
 * - < 1000: exact integer
 * - 1000-999,999: with commas (e.g., 1,234)
 * - 1M+: abbreviated (e.g., 1.23M, 456.7M, 1.2B)
 *
 * Uses a format cache to avoid redundant work on repeated values.
 */
export function formatNumber(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.round(Math.abs(n));

  if (abs < 1000) {
    return sign + String(abs);
  }

  // Cache all formatted positive values, then prepend sign.
  // (avoids cache poisoning: -1000 and 1000 share the same abs=1000 cache key)
  const formatted = cachedFormat(abs, (val) => {
    if (val < 1_000_000) {
      return val.toLocaleString('en-US');
    }
    if (val < 1_000_000_000) {
      const v = val / 1_000_000;
      if (v >= 100) return Math.round(v) + 'M';
      if (Number.isInteger(v)) return v.toFixed(2) + 'M';
      if (Number.isInteger(v * 10)) return v.toFixed(1) + 'M';
      return v.toFixed(2) + 'M';
    }
    if (val < 1_000_000_000_000) {
      const v = val / 1_000_000_000;
      if (v >= 100) return Math.round(v) + 'B';
      if (Number.isInteger(v)) return v.toFixed(2) + 'B';
      if (Number.isInteger(v * 10)) return v.toFixed(1) + 'B';
      return v.toFixed(2) + 'B';
    }
    const exp = Math.floor(Math.log10(val));
    const mantissa = val / Math.pow(10, exp);
    return mantissa.toFixed(2) + 'e' + exp;
  });
  return sign + formatted;
}

/**
 * Format milliseconds as a human-readable time string.
 * - <60s: "Xs"
 * - <1h: "Xm Ys"
 * - >=1h: "Xh Ym" (drops seconds)
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds === 0) return '0s';
  if (totalSeconds < 60) return totalSeconds + 's';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds < 3600) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
